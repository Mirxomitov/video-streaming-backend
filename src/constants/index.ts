import { HydratedDocument, WithTimestamps } from 'mongoose'

export const COLLECTION_TIMESTAMPS = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

export type MongooseDocument<T> = HydratedDocument<
  WithTimestamps<T, typeof COLLECTION_TIMESTAMPS>
>
