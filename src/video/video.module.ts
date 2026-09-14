import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { VideoController } from './video.controller'
import { Video, VideoSchema } from './video.schema'
import { VideoService } from './video.service'
import { BullModule } from '@nestjs/bull'
import { StorageModule } from '../storage/storage.module'
import { VideoProcessor } from './video.processor'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    BullModule.registerQueue({ name: 'video-transcode' }),
    StorageModule,
  ],
  controllers: [VideoController],
  providers: [VideoService, VideoProcessor],
  exports: [VideoService],
})
export class VideoModule {}
