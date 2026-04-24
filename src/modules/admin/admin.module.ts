import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminFeaturesController } from './controllers/admin-features.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminCommunitiesController } from './controllers/admin-communities.controller';
import { PublicFeaturesController } from './controllers/public-features.controller';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminFeaturesService } from './services/admin-features.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminCommunitiesService } from './services/admin-communities.service';
import { FeatureFlagCacheService } from '../../common/services/feature-flag-cache.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    AdminAuthController,
    AdminFeaturesController,
    AdminDashboardController,
    AdminAuditController,
    AdminUsersController,
    AdminCommunitiesController,
    PublicFeaturesController,
  ],
  providers: [
    AdminAuthService,
    AdminFeaturesService,
    AdminDashboardService,
    AdminAuditService,
    AdminUsersService,
    AdminCommunitiesService,
    FeatureFlagCacheService,
  ],
  exports: [AdminFeaturesService, FeatureFlagCacheService],
})
export class AdminModule {}
