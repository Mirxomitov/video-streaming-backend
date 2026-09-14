import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import type { Request } from 'express'

import { VideoService } from './video.service'
import { CreateVideoDto } from './dto/create-video.dto'

@Controller('videos')
export class VideoController {
  constructor(private readonly video_service: VideoService) {}

  // The real upload flow: returns a Mux URL the client PUTs the file to.
  @Post('upload')
  createUpload(@Body() dto: CreateVideoDto, @Req() req: Request) {
    const owner_id = req['user'].sub
    return this.video_service.create_upload(owner_id, dto.title, dto.description)
  }

  @Get()
  list() {
    return this.video_service.find_ready()
  }
}
