import { Body, Controller, Get, Post, Req } from '@nestjs/common'

import { UserService } from './user.service'

@Controller('users')
export class UserController {
  constructor(private readonly user_service: UserService) {}

  @Post()
  async create(@Body('phone') phone: string) {
    return this.user_service.find_or_create(phone)
  }

  @Get('me')
  me(@Req() req: Request) {
    const { sub } = req['user']
    return this.user_service.find_by_id(sub)
  }
}
