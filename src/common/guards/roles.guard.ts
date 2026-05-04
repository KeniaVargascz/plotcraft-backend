import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator';
import { hasRole } from '../constants/roles';
import { UserStatusCacheService } from '../services/user-status-cache.service';
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userStatusCache: UserStatusCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const minRole = this.reflector.getAllAndOverride<number | undefined>(
      MIN_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @MinRole decorator → allow (public or auth-only endpoint)
    if (minRole === undefined) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access denied',
        code: 'FORBIDDEN',
      });
    }

    // Quick check from JWT claim
    if (!hasRole(user.role ?? 0, minRole as any)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    // Verify against DB via cache (never trust JWT alone)
    const status = await this.userStatusCache.getStatus(user.sub);
    if (!hasRole(status.role, minRole as any)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    return true;
  }
}
