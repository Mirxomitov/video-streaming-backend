import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { Video, VideoDocument } from './video.schema'
import { VideoStatus } from './enums/video-status.enum'
import { MuxService } from '../mux/mux.service'

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video.name) private readonly video_model: Model<VideoDocument>,
    private readonly mux_service: MuxService,
  ) {}

  // The real upload path (Mux). Ask Mux for an upload slot, persist a video
  // record tied to that upload, and hand the client the URL to PUT the file to.
  // Transcoding happens on Mux; a webhook (next step) flips status → ready.
  async create_upload(owner_id: string, title: string, description?: string) {
    const { upload_url, upload_id } = await this.mux_service.create_direct_upload()

    const video = await this.video_model.create({
      owner_id,
      title,
      description,
      mux_upload_id: upload_id, // lets the webhook find this doc later
    })

    return { video_id: video.id, upload_url }
  }

  find_ready() {
    return this.video_model.find({ status: VideoStatus.READY })
  }

  find_by_id(id: string) {
    return this.video_model.findById(id)
  }

  // Webhook: Mux finished transcoding. Find the video by the upload id we stored,
  // save the playback info + HLS URL, flip to ready.
  async mark_ready_by_mux_upload(
    upload_id: string | undefined,
    data: { asset_id: string; playback_id?: string; duration?: number },
  ) {
    if (!upload_id) return null
    return this.video_model.findOneAndUpdate(
      { mux_upload_id: upload_id },
      {
        status: VideoStatus.READY,
        mux_asset_id: data.asset_id,
        mux_playback_id: data.playback_id,
        hls_url: data.playback_id
          ? `https://stream.mux.com/${data.playback_id}.m3u8`
          : undefined,
        duration: data.duration,
      },
      { new: true },
    )
  }

  // Webhook: Mux couldn't process the file.
  async mark_failed_by_mux_upload(upload_id: string | undefined) {
    if (!upload_id) return null
    return this.video_model.findOneAndUpdate(
      { mux_upload_id: upload_id },
      { status: VideoStatus.FAILED },
      { new: true },
    )
  }
}
