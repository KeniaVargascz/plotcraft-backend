import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { UserStatusCacheService } from '../services/user-status-cache.service';
import { Role, hasRole } from '../constants/roles';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userStatusCache: UserStatusCacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!hasRole(user?.role ?? 0, Role.MASTER)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access restricted to administrators',
        code: 'FORBIDDEN',
      });
    }

    // Verify role from DB via cache — never trust JWT claim alone
    const status = await this.userStatusCache.getAdminStatus(user!.sub);
    if (!hasRole(status.role, Role.MASTER)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access restricted to administrators',
        code: 'FORBIDDEN',
      });
    }

    return true;
  }
}
