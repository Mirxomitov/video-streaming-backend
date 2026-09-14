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

  // Mux identifiers — the chain: upload → asset → playback
  // upload_id is set now (at upload); asset/playback are filled by the webhook later.
  @Prop({ required: false })
  mux_upload_id?: string

  @Prop({ required: false })
  mux_asset_id?: string

  @Prop({ required: false })
  mux_playback_id?: string
}

export const VideoSchema = SchemaFactory.createForClass(Video)