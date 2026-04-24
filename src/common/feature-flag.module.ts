import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureFlagCacheService } from './services/feature-flag-cache.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [FeatureFlagCacheService],
  exports: [FeatureFlagCacheService],
})
export class FeatureFlagModule {}
