import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  CacheService,
  CACHE_SERVICE,
} from '../../../common/services/cache.service';

export type JwtPayload = {
  sub: string;
  username: string;
  email: string;
  isAdmin: boolean;
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
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Check token-level blacklist (logout)
    if (payload.jti) {
      const tokenBlacklisted = await this.cache.get(
        `${ACCESS_TOKEN_BLACKLIST_PREFIX}${payload.jti}`,
      );
      if (tokenBlacklisted) {
        throw new UnauthorizedException('Token revocado');
      }
    }

    // Check user-level blacklist (password reset)
    const userBlacklisted = await this.cache.get(
      `blacklist:user:${payload.sub}`,
    );
    if (userBlacklisted) {
      // Only blacklist tokens issued before the password reset
      // The iat claim (issued at) tells us when this token was created
      // If there's a user blacklist, ALL existing tokens are invalid
      throw new UnauthorizedException('Token revocado por cambio de contraseña');
    }

    return payload;
  }
}
