import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { Like } from './like.schema'
import { VideoService } from '../video/video.service'

@Injectable()
export class LikeService {
  constructor(
    @InjectModel(Like.name) private readonly like_model: Model<Like>,
    private readonly video_service: VideoService,
  ) {}

  async add(video_id: string, owner_id: string) {
    if (!await this.video_service.find_by_id(video_id)) throw new NotFoundException('Video not found')
    try {
      await this.like_model.create({ video_id, owner_id })
      const video = await this.video_service.increment_likes(video_id, 1)
      return { liked: true, likes_count: video?.likes_count ?? 0 }
    } catch (error: any) {
      if (error?.code !== 11000) throw error
      const video = await this.video_service.find_by_id(video_id)
      return { liked: true, likes_count: video?.likes_count ?? 0 }
    }
  }

  async remove(video_id: string, owner_id: string) {
    const result = await this.like_model.deleteOne({ video_id, owner_id })
    if (result.deletedCount) await this.video_service.increment_likes(video_id, -1)
    const video = await this.video_service.find_by_id(video_id)
    return { liked: false, likes_count: video?.likes_count ?? 0 }
  }
}
