import { Controller, Delete, HttpCode, Param, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { LikeService } from './like.service'

@Controller('videos/:id/like')
export class LikeController {
  constructor(private readonly like_service: LikeService) {}

  @Post()
  @HttpCode(200)
  add(@Param('id') id: string, @Req() req: Request) {
    return this.like_service.add(id, req['user'].sub)
  }

  @Delete()
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.like_service.remove(id, req['user'].sub)
  }
}
