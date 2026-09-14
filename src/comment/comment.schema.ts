import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import mongoose from 'mongoose'
import { COLLECTION_TIMESTAMPS, MongooseDocument } from '../constants'

@Schema({ timestamps: COLLECTION_TIMESTAMPS, collection: 'comments' })
export class Comment {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true, index: true })
  video_id!: mongoose.Types.ObjectId

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  owner_id!: mongoose.Types.ObjectId

  @Prop({ required: true, trim: true, maxlength: 1000 })
  text!: string
}

export type CommentDocument = MongooseDocument<Comment>
export const CommentSchema = SchemaFactory.createForClass(Comment)
