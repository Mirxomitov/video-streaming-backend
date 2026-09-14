import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { CommentService } from './comment.service'

class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text!: string
}

@Controller()
export class CommentController {
  constructor(private readonly comment_service: CommentService) {}

  @Get('videos/:video_id/comments')
  list(@Param('video_id') video_id: string) {
    return this.comment_service.list(video_id)
  }

  @Post('videos/:video_id/comments')
  create(@Param('video_id') video_id: string, @Body() dto: CreateCommentDto, @Req() req: Request) {
    return this.comment_service.create(video_id, req['user'].sub, dto.text)
  }

  @Delete('comments/:id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.comment_service.remove(id, req['user'].sub)
  }
}
