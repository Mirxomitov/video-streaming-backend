import { Body, Controller, Get, NotFoundException, Param, Patch } from '@nestjs/common'
import { IsBoolean } from 'class-validator'
import { Roles } from '../common/decorators/roles.decorator'
import { UserRole } from '../user/user.schema'
import { VideoService } from '../video/video.service'
import { UserService } from '../user/user.service'

class ModerateVideoDto {
  @IsBoolean()
  hidden!: boolean
}

class BanUserDto {
  @IsBoolean()
  is_banned!: boolean
}

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly video_service: VideoService,
    private readonly user_service: UserService,
  ) {}

  @Get('videos')
  videos() {
    return this.video_service.list_for_moderation()
  }

  @Patch('videos/:id/moderation')
  async moderate(@Param('id') id: string, @Body() dto: ModerateVideoDto) {
    const video = await this.video_service.moderate(id, dto.hidden)
    if (!video) throw new NotFoundException('Video not found')
    return video
  }

  @Get('users')
  users() {
    return this.user_service.list_for_moderation()
  }

  @Patch('users/:id/ban')
  async ban(@Param('id') id: string, @Body() dto: BanUserDto) {
    const user = await this.user_service.set_banned(id, dto.is_banned)
    if (!user) throw new NotFoundException('User not found')
    return user
  }
}
