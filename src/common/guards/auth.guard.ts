import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Request } from 'express'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt_service: JwtService,
    private readonly reflector: Reflector,
    private readonly config_service: ConfigService, // ← needed for the secret
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Read the @Public() note. If the route (or its controller) is public, let it through.
    const is_public = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // the route method, e.g. login()
      context.getClass(), // the controller class
    ])
    if (is_public) return true

    // 2. Grab the raw HTTP request. switchToHttp() unwraps the transport-agnostic
    //    context into the Express request you actually care about.
    const request = context.switchToHttp().getRequest<Request>()

    // 3. Pull the token out of "Authorization: Bearer <token>".
    const token = this.extract_token(request)
    if (!token) {
      throw new UnauthorizedException('No token') // → 401
    }

    // 4. Verify signature + expiry with the SAME secret you signed with.
    //    verifyAsync throws if the token is tampered/expired — we catch and 401.
    try {
      const payload = await this.jwt_service.verifyAsync(token, {
        secret: this.config_service.get<string>('JWT_SECRET'),
      })
      // 5. Stash the payload on the request so controllers/decorators can read it.
      request['user'] = payload
    } catch {
      throw new UnauthorizedException('Invalid token')
    }

    // 6. Passed every check → allow the request.
    return true
  }

  // Small helper: "Bearer eyJ..." → "eyJ...", else undefined.
  private extract_token(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
