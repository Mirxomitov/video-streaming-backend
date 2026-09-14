import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { ROLES_KEY } from '../decorators/roles.decorator'
import { UserService } from '../../user/user.service'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly user_service: UserService) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required?.length) return true

    const request = context.switchToHttp().getRequest<Request>()
    const user = await this.user_service.find_by_id(request['user']?.sub)
    if (!user || !required.includes(user.role)) throw new ForbiddenException('Admin access required')
    return true
  }
}
