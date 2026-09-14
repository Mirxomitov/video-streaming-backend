import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { VideoService } from '../video/video.service'
import { WatchHistory } from './history.schema'

@Injectable()
export class HistoryService {
  constructor(
    @InjectModel(WatchHistory.name) private readonly history_model: Model<WatchHistory>,
    private readonly video_service: VideoService,
  ) {}

  async save(video_id: string, owner_id: string, position_seconds: number) {
    if (!await this.video_service.find_by_id(video_id)) throw new NotFoundException('Video not found')
    return this.history_model.findOneAndUpdate(
      { video_id, owner_id },
      { position_seconds },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )
  }

  list(owner_id: string) {
    return this.history_model
      .find({ owner_id })
      .populate('video_id')
      .sort({ updated_at: -1 })
      .limit(100)
  }
}
