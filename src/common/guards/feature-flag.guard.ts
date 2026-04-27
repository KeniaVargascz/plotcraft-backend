import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from '../decorators/require-feature.decorator';
import { FeatureFlagCacheService } from '../services/feature-flag-cache.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagCache: FeatureFlagCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!featureKey) return true;

    const isEnabled = await this.featureFlagCache.isEnabled(featureKey);
    if (!isEnabled) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Feature not available',
        code: 'FEATURE_DISABLED',
      });
    }

    return true;
  }
}
