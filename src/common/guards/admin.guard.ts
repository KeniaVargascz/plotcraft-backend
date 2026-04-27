import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { UserStatusCacheService } from '../services/user-status-cache.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userStatusCache: UserStatusCacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user?.isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access restricted to administrators',
        code: 'FORBIDDEN',
      });
    }

    // Verify admin status from DB via cache — never trust JWT claim alone
    const status = await this.userStatusCache.getAdminStatus(user.sub);
    if (!status.isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access restricted to administrators',
        code: 'FORBIDDEN',
      });
    }

    return true;
  }
}
