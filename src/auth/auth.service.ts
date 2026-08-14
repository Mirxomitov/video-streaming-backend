import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { UserService } from '../user/user.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly config_service: ConfigService,
    private readonly jwt_service: JwtService,
    private readonly user_service: UserService,
  ) {}


  async send_otp(phone: string) {
    // currently mock telegram true with DEFAULT_OTP_CODE
    return { ok: true }
  }

  async login(phone: string, code: string) {

    const expected_code = this.config_service.get<string>('DEFAULT_OTP_CODE')

    if (expected_code !== code) {
      throw new UnauthorizedException('Invalid code')
    }

    const user = await this.user_service.find_or_create(phone)

    return { access_token: await this.jwt_service.signAsync({ sub: user.id }) }
  }
}
