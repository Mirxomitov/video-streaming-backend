import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import mongoose from 'mongoose'

@Schema({ timestamps: true })
export class Like {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true })
  video_id!: mongoose.Types.ObjectId

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  owner_id!: mongoose.Types.ObjectId
}

export const LikeSchema = SchemaFactory.createForClass(Like)
LikeSchema.index({ video_id: 1, owner_id: 1 }, { unique: true })
