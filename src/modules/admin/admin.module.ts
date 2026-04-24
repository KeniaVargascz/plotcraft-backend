import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminFeaturesController } from './controllers/admin-features.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminCommunitiesController } from './controllers/admin-communities.controller';
import { AdminNovelsController } from './controllers/admin-novels.controller';
import { AdminForumController } from './controllers/admin-forum.controller';
import { AdminCatalogsController } from './controllers/admin-catalogs.controller';
import { AdminPostsController } from './controllers/admin-posts.controller';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { PublicFeaturesController } from './controllers/public-features.controller';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminFeaturesService } from './services/admin-features.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminCommunitiesService } from './services/admin-communities.service';
import { AdminNovelsService } from './services/admin-novels.service';
import { AdminForumService } from './services/admin-forum.service';
import { AdminCatalogsService } from './services/admin-catalogs.service';
import { AdminPostsService } from './services/admin-posts.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminSettingsService } from './services/admin-settings.service';
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
    AdminNovelsController,
    AdminForumController,
    AdminCatalogsController,
    AdminPostsController,
    AdminAnalyticsController,
    AdminSettingsController,
    PublicFeaturesController,
  ],
  providers: [
    AdminAuthService,
    AdminFeaturesService,
    AdminDashboardService,
    AdminAuditService,
    AdminUsersService,
    AdminCommunitiesService,
    AdminNovelsService,
    AdminForumService,
    AdminCatalogsService,
    AdminPostsService,
    AdminAnalyticsService,
    AdminSettingsService,
    FeatureFlagCacheService,
  ],
  exports: [AdminFeaturesService, FeatureFlagCacheService],
})
export class AdminModule {}
