import { Processor, Process } from '@nestjs/bull'
import type { Job } from 'bull'

import { VideoService } from './video.service'
import { VideoStatus } from './enums/video-status.enum'

// A @Processor is a CONSUMER bound to a queue by name — it must match the name
// you gave registerQueue in video.module.ts. Bull discovers this class via the
// decorator, pulls jobs off 'video-transcode', and runs @Process() once per job
// in the background. You never call transcode() yourself.
@Processor('video-transcode')
export class VideoProcessor {
  constructor(private readonly video_service: VideoService) {}

  @Process()
  async transcode(job: Job<{ video_id: string }>) {
    const { video_id } = job.data

    // 1. mark it as being worked on
    console.log(`[transcode] start ${video_id}`)
    await this.video_service.update_status(video_id, VideoStatus.PROCESSING)

    // 2. stand in for the real ffmpeg work (~3s). Later this whole block
    //    becomes: upload to Mux / run ffmpeg → HLS.
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // 3. done — flip to ready so it shows up in the feed
    await this.video_service.update_status(video_id, VideoStatus.READY)
    console.log(`[transcode] done ${video_id}`)
  }
}
