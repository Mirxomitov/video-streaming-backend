import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import mongoose from 'mongoose'

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class WatchHistory {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner_id!: mongoose.Types.ObjectId

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true })
  video_id!: mongoose.Types.ObjectId

  @Prop({ default: 0, min: 0 })
  position_seconds!: number

  updated_at!: Date
}

export const WatchHistorySchema = SchemaFactory.createForClass(WatchHistory)
WatchHistorySchema.index({ owner_id: 1, video_id: 1 }, { unique: true })
