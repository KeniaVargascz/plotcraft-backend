import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminFeaturesController } from './controllers/admin-features.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminFeaturesService } from './services/admin-features.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminAuditService } from './services/admin-audit.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    AdminAuthController,
    AdminFeaturesController,
    AdminDashboardController,
    AdminAuditController,
  ],
  providers: [
    AdminAuthService,
    AdminFeaturesService,
    AdminDashboardService,
    AdminAuditService,
  ],
  exports: [AdminFeaturesService],
})
export class AdminModule {}
