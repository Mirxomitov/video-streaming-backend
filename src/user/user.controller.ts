import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { IsOptional, IsString, MaxLength } from 'class-validator'
import { VideoService } from '../video/video.service'

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  full_name?: string
}

import { UserService } from './user.service'

@Controller('users')
export class UserController {
  constructor(
    private readonly user_service: UserService,
    private readonly video_service: VideoService,
  ) {}

  @Post()
  async create(@Body('phone') phone: string) {
    return this.user_service.find_or_create(phone)
  }

  @Get('me')
  me(@Req() req: Request) {
    const { sub } = req['user']
    return this.user_service.find_by_id(sub)
  }

  @Patch('me')
  async update_me(@Body() dto: UpdateProfileDto, @Req() req: Request) {
    const user = await this.user_service.update_profile(req['user'].sub, dto.full_name ?? '')
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  @Get(':id/videos')
  videos(@Param('id') id: string) {
    return this.video_service.find_ready_by_owner(id)
  }

  @Get(':id')
  async profile(@Param('id') id: string) {
    const user = await this.user_service.find_by_id(id)
    if (!user) throw new NotFoundException('User not found')
    return { _id: user.id, full_name: user.full_name, created_at: user.created_at }
  }
}
