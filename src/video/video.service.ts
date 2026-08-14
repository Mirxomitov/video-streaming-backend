import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { Video, VideoDocument } from './video.schema'
import { VideoStatus } from './enums/video-status.enum'

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video.name) private readonly video_model: Model<VideoDocument>,
  ) {}

  create(owner_id: string, title: string, description?: string) {
    return this.video_model.create({ owner_id, title, description })
  }

  find_ready() {
    return this.video_model.find({ status: VideoStatus.READY })
  }

  find_by_id(id: string) {
    return this.video_model.findById(id)
  }
}