import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { Video, VideoDocument } from './video.schema'
import { VideoStatus } from './enums/video-status.enum'
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video.name) private readonly video_model: Model<VideoDocument>,
    @InjectQueue('video-transcode') private readonly transcode_queue: Queue,
  ) {}

  async create(owner_id: string, title: string, description?: string) {
    const video = await this.video_model.create({ owner_id, title, description })
    // a job carrying the video's id
    await this.transcode_queue.add({ video_id: video.id })
    return video
  }

  find_ready() {
    return this.video_model.find({ status: VideoStatus.READY })
  }

  find_by_id(id: string) {
    return this.video_model.findById(id)
  }

  async update_status(id: string, status: VideoStatus) {
    return this.video_model.findByIdAndUpdate(id, { status })
  }
}