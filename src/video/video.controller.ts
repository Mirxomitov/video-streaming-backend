import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'

import { VideoService } from './video.service'
import { CreateVideoDto } from './dto/create-video.dto'
import { UpdateVideoDto } from './dto/update-video.dto'

@Controller('videos')
export class VideoController {
  constructor(private readonly video_service: VideoService) {}

  @Post('upload')
  createUpload(@Body() dto: CreateVideoDto, @Req() req: Request) {
    const owner_id = req['user'].sub
    return this.video_service.create_upload(owner_id, dto.title, dto.description)
  }

  @Post(':id/complete')
  @HttpCode(202)
  async complete(@Param('id') id: string, @Req() req: Request) {
    const video = await this.video_service.complete_upload(id, req['user'].sub)
    if (!video) throw new NotFoundException('Video not found')
    return { video_id: video.id, status: video.status }
  }

  @Get('categories')
  categories() {
    return this.video_service.categories()
  }

  @Get('tags')
  tags() {
    return this.video_service.tags()
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateVideoDto, @Req() req: Request) {
    const video = await this.video_service.update_metadata(id, req['user'].sub, dto.category, dto.tags)
    if (!video) throw new NotFoundException('Video not found')
    return video
  }

  @Post(':id/views')
  @HttpCode(202)
  async view(@Param('id') id: string) {
    const video = await this.video_service.increment_views(id)
    if (!video) throw new NotFoundException('Video not found')
    return { views_count: video.views_count }
  }

  @Get()
  list(
    @Query('limit') limit_raw?: string,
    @Query('before') before?: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
    @Query('q') q?: string,
  ) {
    const limit = limit_raw === undefined ? 20 : Number(limit_raw)
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('limit must be an integer between 1 and 50')
    }
    return this.video_service.find_ready(limit, before, { category, tag, q })
  }
}
