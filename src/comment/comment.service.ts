import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { VideoService } from '../video/video.service'
import { Comment, CommentDocument } from './comment.schema'

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private readonly comment_model: Model<CommentDocument>,
    private readonly video_service: VideoService,
  ) {}

  async create(video_id: string, owner_id: string, text: string) {
    if (!await this.video_service.find_by_id(video_id)) throw new NotFoundException('Video not found')
    return this.comment_model.create({ video_id, owner_id, text })
  }

  list(video_id: string) {
    return this.comment_model.find({ video_id }).sort({ created_at: -1 }).limit(100)
  }

  async remove(id: string, owner_id: string) {
    const comment = await this.comment_model.findById(id)
    if (!comment) throw new NotFoundException('Comment not found')
    if (comment.owner_id.toString() !== owner_id) throw new ForbiddenException('Not your comment')
    await comment.deleteOne()
  }
}
