import { Process, Processor } from '@nestjs/bull'
import type { Job } from 'bull'
import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { StorageService } from '../storage/storage.service'
import { Video, VideoDocument } from './video.schema'
import { VideoService } from './video.service'

const exec_file = promisify(execFile)

@Processor('video-transcode')
export class VideoProcessor {
  constructor(
    @InjectModel(Video.name) private readonly video_model: Model<VideoDocument>,
    private readonly storage_service: StorageService,
    private readonly video_service: VideoService,
  ) {}

  @Process()
  async transcode(job: Job<{ video_id: string }>) {
    const video = await this.video_model.findById(job.data.video_id)
    if (!video) throw new Error(`Video not found: ${job.data.video_id}`)

    const work_dir = join('/tmp/videostream', video.id)
    const input_path = join(work_dir, 'source.mp4')
    const output_dir = join(work_dir, 'hls')
    const output_prefix = `videos/${video.id}`

    try {
      await mkdir(output_dir, { recursive: true })
      await this.storage_service.download_to_file(video.source_key, input_path)
      await this.run_ffmpeg(input_path, output_dir)

      const thumbnail_path = join(work_dir, 'thumbnail.jpg')
      await exec_file('ffmpeg', [
        '-y', '-i', input_path, '-frames:v', '1', '-q:v', '3', thumbnail_path,
      ])

      await this.upload_directory(output_dir, output_prefix)
      await this.storage_service.upload_file(
        thumbnail_path,
        `${output_prefix}/thumbnail.jpg`,
        'image/jpeg',
      )

      await this.video_service.mark_ready(
        video.id,
        this.storage_service.public_url(`${output_prefix}/master.m3u8`),
        this.storage_service.public_url(`${output_prefix}/thumbnail.jpg`),
      )
    } catch (error) {
      await this.video_service.mark_failed(video.id)
      throw error
    } finally {
      await rm(work_dir, { recursive: true, force: true })
    }
  }

  private async run_ffmpeg(input_path: string, output_dir: string) {
    for (const variant of ['360', '720', '1080']) {
      await mkdir(join(output_dir, `v${variant}`), { recursive: true })
    }

    await exec_file('ffmpeg', [
      '-y', '-i', input_path,
      '-filter_complex',
      '[0:v]split=3[v360][v720][v1080];' +
        '[v360]scale=w=640:h=-2:force_original_aspect_ratio=decrease[v360out];' +
        '[v720]scale=w=1280:h=-2:force_original_aspect_ratio=decrease[v720out];' +
        '[v1080]scale=w=1920:h=-2:force_original_aspect_ratio=decrease[v1080out]',
      '-map', '[v360out]', '-map', '0:a:0?',
      '-map', '[v720out]', '-map', '0:a:0?',
      '-map', '[v1080out]', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
      '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
      '-hls_segment_filename', join(output_dir, 'v%v/segment_%03d.ts'),
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2',
      join(output_dir, 'v%v/index.m3u8'),
    ])
  }

  private async upload_directory(directory: string, prefix: string) {
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const local_path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await this.upload_directory(local_path, `${prefix}/${entry.name}`)
      } else {
        const content_type = entry.name.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : 'video/mp2t'
        await this.storage_service.upload_file(local_path, `${prefix}/${entry.name}`, content_type)
      }
    }
  }
}
