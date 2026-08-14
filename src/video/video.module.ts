import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { VideoController } from './video.controller'
import { Video, VideoSchema } from './video.schema'
import { VideoService } from './video.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
  ],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
