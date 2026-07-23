import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

import { COLLECTION_TIMESTAMPS, MongooseDocument } from '../constants'

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}


@Schema({ timestamps: COLLECTION_TIMESTAMPS, collection: 'users' })
export class User {
  @Prop({required: true, unique: true  })
  phone!: string

  @Prop()
  full_name?: string
}

export type UserDocument =  MongooseDocument<User>
export const UserSchema = SchemaFactory.createForClass(User)
