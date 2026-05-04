import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminCleanupService } from '../services/admin-cleanup.service';
import { AdminUserCleanupService } from '../services/admin-user-cleanup.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/cleanup')
@Controller('admin/cleanup')
@UseGuards(AdminGuard)
export class AdminCleanupController {
  constructor(
    private readonly cleanupService: AdminCleanupService,
    private readonly userCleanupService: AdminUserCleanupService,
  ) {}

  @Get('tokens/preview')
  @ApiOperation({ summary: 'Preview expired tokens to be purged' })
  previewTokens() {
    return this.cleanupService.previewExpiredTokens();
  }

  @Delete('tokens')
  @ApiOperation({ summary: 'Purge expired and old revoked refresh tokens' })
  purgeTokens(@CurrentUser() admin: JwtPayload) {
    return this.cleanupService.purgeExpiredTokens(admin);
  }

  @Get('otps/preview')
  @ApiOperation({ summary: 'Preview expired/used OTPs to be purged' })
  previewOtps() {
    return this.cleanupService.previewExpiredOtps();
  }

  @Delete('otps')
  @ApiOperation({ summary: 'Purge expired and used OTP codes' })
  purgeOtps(@CurrentUser() admin: JwtPayload) {
    return this.cleanupService.purgeExpiredOtps(admin);
  }

  @Get('notifications/preview')
  @ApiOperation({ summary: 'Preview old notifications to be purged' })
  previewNotifications() {
    return this.cleanupService.previewOldNotifications();
  }

  @Delete('notifications')
  @ApiOperation({ summary: 'Purge read >30d and unread >90d notifications' })
  purgeNotifications(@CurrentUser() admin: JwtPayload) {
    return this.cleanupService.purgeOldNotifications(admin);
  }

  @Get('reading-history/preview')
  @ApiOperation({ summary: 'Preview reading history older than 1 year' })
  previewReadingHistory() {
    return this.cleanupService.previewOldReadingHistory();
  }

  @Delete('reading-history')
  @ApiOperation({ summary: 'Purge reading history older than 1 year' })
  purgeReadingHistory(@CurrentUser() admin: JwtPayload) {
    return this.cleanupService.purgeOldReadingHistory(admin);
  }

  @Get('inactive-users/preview')
  @ApiOperation({ summary: 'List inactive user candidates for cleanup' })
  previewInactiveUsers(@Query('days') days?: string) {
    return this.userCleanupService.previewInactiveUsers(
      days ? parseInt(days, 10) : 180,
    );
  }

  @Delete('inactive-users/all')
  @ApiOperation({ summary: 'Cleanup ALL inactive users (backup + deactivate)' })
  cleanupAllInactive(@Query('days') days: string | undefined, @CurrentUser() admin: JwtPayload) {
    return this.userCleanupService.cleanupAllInactive(
      days ? parseInt(days, 10) : 180,
      admin,
    );
  }

  @Delete('inactive-users/:id')
  @ApiOperation({ summary: 'Cleanup inactive user data (backup + deactivate)' })
  cleanupUser(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.userCleanupService.cleanupUser(id, admin);
  }

  @Post('inactive-users/:id/restore')
  @ApiOperation({ summary: 'Restore cleaned user from backup' })
  restoreUser(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.userCleanupService.restoreUser(id, admin);
  }
}
