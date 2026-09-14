import { Module } from '@nestjs/common'
import { VideoModule } from '../video/video.module'
import { UserModule } from '../user/user.module'
import { AdminController } from './admin.controller'

@Module({ imports: [VideoModule, UserModule], controllers: [AdminController] })
export class AdminModule {}
