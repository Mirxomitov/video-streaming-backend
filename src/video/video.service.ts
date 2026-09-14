import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { Video, VideoDocument } from './video.schema'
import { VideoStatus } from './enums/video-status.enum'
import { StorageService } from '../storage/storage.service'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { randomUUID } from 'node:crypto'

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video.name) private readonly video_model: Model<VideoDocument>,
    @InjectQueue('video-transcode') private readonly transcode_queue: Queue,
    private readonly storage_service: StorageService,
  ) {}

  async create_upload(owner_id: string, title: string, description?: string) {
    const id = randomUUID()
    const source_key = `uploads/${owner_id}/${id}.mp4`
    const upload_url = await this.storage_service.create_upload_url(source_key, 'video/mp4')

    const video = await this.video_model.create({
      owner_id,
      title,
      description,
      source_key,
    })

    return { video_id: video.id, upload_url }
  }

  async complete_upload(video_id: string, owner_id: string) {
    const video = await this.video_model.findOne({ _id: video_id, owner_id })
    if (!video) return null
    if (video.status !== VideoStatus.UPLOADING) return video

    video.status = VideoStatus.PROCESSING
    await video.save()
    await this.transcode_queue.add(
      { video_id: video.id },
      { jobId: video.id, removeOnComplete: true, removeOnFail: 100 },
    )
    return video
  }

  async find_ready(
    limit = 20,
    before?: string,
    filters: { category?: string; tag?: string; q?: string } = {},
  ) {
    const page_size = Math.min(Math.max(limit, 1), 50)
    const filter: Record<string, any> = { status: VideoStatus.READY }

    if (filters.category) filter.category = filters.category
    if (filters.tag) filter.tags = filters.tag
    if (filters.q) {
      const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
      ]
    }

    if (before) {
      let cursor: { created_at: string; id: string }
      try {
        cursor = JSON.parse(Buffer.from(before, 'base64url').toString())
        if (!cursor.created_at || !cursor.id || !Types.ObjectId.isValid(cursor.id)) {
          throw new Error('invalid cursor')
        }
      } catch {
        throw new BadRequestException('Invalid pagination cursor')
      }

      const created_at = new Date(cursor.created_at)
      if (Number.isNaN(created_at.getTime())) {
        throw new BadRequestException('Invalid pagination cursor')
      }
      const cursor_filter = [
        { created_at: { $lt: created_at } },
        { created_at, _id: { $lt: cursor.id } },
      ]
      filter.$and = [...(filter.$and ?? []), { $or: cursor_filter }]
    }

    const videos = await this.video_model
      .find(filter)
      .sort({ created_at: -1, _id: -1 })
      .limit(page_size + 1)
      .exec()

    const has_next = videos.length > page_size
    const items = has_next ? videos.slice(0, page_size) : videos
    const last = items.at(-1)
    const next_cursor = has_next && last?.created_at
      ? Buffer.from(JSON.stringify({
          created_at: last.created_at.toISOString(),
          id: last.id,
        })).toString('base64url')
      : null

    return { items, next_cursor }
  }

  find_by_id(id: string) {
    return this.video_model.findById(id)
  }

  async update_metadata(video_id: string, owner_id: string, category?: string, tags?: string[]) {
    return this.video_model.findOneAndUpdate(
      { _id: video_id, owner_id },
      {
        ...(category !== undefined ? { category: category.trim().toLowerCase() || undefined } : {}),
        ...(tags !== undefined
          ? { tags: [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))] }
          : {}),
      },
      { returnDocument: 'after' },
    )
  }

  categories() {
    return this.video_model.distinct('category', { status: VideoStatus.READY, category: { $ne: null } })
  }

  tags() {
    return this.video_model.distinct('tags', { status: VideoStatus.READY })
  }

  increment_views(video_id: string) {
    return this.video_model.findByIdAndUpdate(video_id, { $inc: { views_count: 1 } }, { returnDocument: 'after' })
  }

  increment_likes(video_id: string, amount: 1 | -1) {
    return this.video_model.findByIdAndUpdate(video_id, { $inc: { likes_count: amount } }, { returnDocument: 'after' })
  }

  find_ready_by_owner(owner_id: string, limit = 20) {
    return this.video_model.find({ owner_id, status: VideoStatus.READY }).sort({ created_at: -1 }).limit(limit)
  }

  list_for_moderation() {
    return this.video_model.find().sort({ created_at: -1 }).limit(100)
  }

  moderate(video_id: string, hidden: boolean) {
    return this.video_model.findByIdAndUpdate(
      video_id,
      { status: hidden ? VideoStatus.HIDDEN : VideoStatus.READY },
      { returnDocument: 'after' },
    )
  }

  async mark_ready(video_id: string, hls_url: string, thumbnail_url: string) {
    return this.video_model.findByIdAndUpdate(video_id, {
      status: VideoStatus.READY,
      hls_url,
      thumbnail_url,
    }, { returnDocument: 'after' })
  }

  async mark_failed(video_id: string) {
    return this.video_model.findByIdAndUpdate(video_id, { status: VideoStatus.FAILED }, { returnDocument: 'after' })
  }
}
