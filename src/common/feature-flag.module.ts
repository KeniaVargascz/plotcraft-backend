import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureFlagCacheService } from './services/feature-flag-cache.service';
import { UserStatusCacheService } from './services/user-status-cache.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [FeatureFlagCacheService, UserStatusCacheService],
  exports: [FeatureFlagCacheService, UserStatusCacheService],
})
export class FeatureFlagModule {}
