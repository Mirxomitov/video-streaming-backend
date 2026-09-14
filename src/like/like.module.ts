import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { VideoModule } from '../video/video.module'
import { LikeController } from './like.controller'
import { Like, LikeSchema } from './like.schema'
import { LikeService } from './like.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Like.name, schema: LikeSchema }]), VideoModule],
  controllers: [LikeController],
  providers: [LikeService],
})
export class LikeModule {}
