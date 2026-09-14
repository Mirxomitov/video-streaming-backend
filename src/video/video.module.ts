import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { VideoController } from './video.controller'
import { MuxWebhookController } from './mux-webhook.controller'
import { Video, VideoSchema } from './video.schema'
import { VideoService } from './video.service'
import { VideoProcessor } from './video.processor'
import { BullModule } from '@nestjs/bull';
import { MuxModule } from '../mux/mux.module'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema },],),
    BullModule.registerQueue({ name: 'video-transcode' }),
    MuxModule,
  ],
  controllers: [VideoController, MuxWebhookController],
  providers: [VideoService, VideoProcessor],
  exports: [VideoService],
})
export class VideoModule {}
