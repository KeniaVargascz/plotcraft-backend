import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  CacheService,
  CACHE_SERVICE,
} from '../../../common/services/cache.service';
import { FeatureFlagCacheService } from '../../../common/services/feature-flag-cache.service';
import { UserStatusCacheService } from '../../../common/services/user-status-cache.service';
import { APP_CONFIG } from '../../../config/constants';
import { Role, hasRole } from '../../../common/constants/roles';

export type JwtPayload = {
  sub: string;
  username: string;
  email: string;
  role: number;
  isAdmin: boolean; // deprecated — use role >= Role.ADMIN
  jti: string;
  iat?: number;
  exp?: number;
};

export const ACCESS_TOKEN_BLACKLIST_PREFIX = 'blacklist:access:';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    private readonly userStatusCache: UserStatusCacheService,
    private readonly featureFlagCache: FeatureFlagCacheService,
  ) {
    const jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
    if (jwtSecret.length < 32) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters (256 bits minimum)',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // 1. Check token-level blacklist (logout)
    if (payload.jti) {
      const tokenBlacklisted = await this.cache.get(
        `${ACCESS_TOKEN_BLACKLIST_PREFIX}${payload.jti}`,
      );
      if (tokenBlacklisted) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Token revoked',
          code: 'TOKEN_REVOKED',
        });
      }
    }

    // 2. Check user-level blacklist (password reset / logout-all)
    // Value is the Unix timestamp (seconds) when the blacklist was set.
    // Only tokens issued BEFORE that timestamp are rejected.
    const userBlacklistedAt = await this.cache.get<number>(
      `blacklist:user:${payload.sub}`,
    );
    if (userBlacklistedAt && payload.iat && payload.iat < userBlacklistedAt) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Session invalidated',
        code: 'SESSION_INVALIDATED',
      });
    }

    // 3. Check user exists, is active, and is not locked
    const status = await this.userStatusCache.getStatus(payload.sub);

    if (!status.exists) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!status.isActive) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Account disabled',
        code: 'ACCOUNT_DISABLED',
      });
    }

    if (
      status.failedLoginAttempts >= APP_CONFIG.auth.maxFailedAttempts &&
      status.lockedUntil &&
      new Date(status.lockedUntil) > new Date()
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Account locked',
        code: 'ACCOUNT_LOCKED',
      });
    }

    // 4. Check if feature flags changed after token was issued
    // Skip for MASTER users — they are the ones changing flags
    if (!hasRole(payload.role ?? 0, Role.MASTER)) {
      const flagsChanged =
        await this.featureFlagCache.getLastChangedTimestamp();
      if (flagsChanged && payload.iat && flagsChanged > payload.iat) {
        throw new ForbiddenException({
          statusCode: 403,
          message: 'Session expired due to configuration change',
          code: 'FLAGS_CHANGED',
        });
      }
    }

    return payload;
  }
}
