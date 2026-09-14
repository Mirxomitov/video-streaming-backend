import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { VideoModule } from '../video/video.module'
import { HistoryController } from './history.controller'
import { WatchHistory, WatchHistorySchema } from './history.schema'
import { HistoryService } from './history.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: WatchHistory.name, schema: WatchHistorySchema }]), VideoModule],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
