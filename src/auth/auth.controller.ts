import { Body, Controller, Post } from '@nestjs/common'

import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { IS_PUBLIC_KEY, Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth_service: AuthService) {}

  @Post('otp')
  @Public()
  async send_otp(@Body('phone') phone: string) {
    return await this.auth_service.send_otp(phone)
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return await this.auth_service.login(dto.phone, dto.code)
  }
}
