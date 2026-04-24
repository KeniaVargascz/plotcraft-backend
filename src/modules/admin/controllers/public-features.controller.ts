import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { CacheTtl } from '../../../common/decorators/cache-ttl.decorator';
import { FeatureFlagCacheService } from '../../../common/services/feature-flag-cache.service';

@ApiTags('features')
@Controller('features')
export class PublicFeaturesController {
  constructor(private readonly featureFlagCache: FeatureFlagCacheService) {}

  @Get('active')
  @Public()
  @CacheTtl(60)
  @ApiOperation({ summary: 'Feature flags activos (público, para frontend)' })
  async getActive() {
    return this.featureFlagCache.getActiveFlags();
  }
}
