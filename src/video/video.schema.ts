import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import mongoose, { HydratedDocument } from 'mongoose'
import { VideoStatus } from './enums/video-status.enum'

export type VideoDocument = HydratedDocument<Video>

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Video {
  @Prop({required: true})
  title!: string

  @Prop({required: false})
  description?: string

  @Prop({
    type: String,
    enum: VideoStatus,
    default: VideoStatus.UPLOADING,
  })
  status!: VideoStatus

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  owner_id!: mongoose.Types.ObjectId

  //(stays empty until transcode finishes)
  @Prop({required: false})
  hls_url?: string

  @Prop({required: false})
  thumbnail_url?: string

  //(seconds)
  @Prop({required: false})
  duration?: number
}

export const VideoSchema = SchemaFactory.createForClass(Video)