import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

export interface CleanupResult {
  task: string;
  deletedCount: number;
  details?: Record<string, unknown>;
}

@Injectable()
export class AdminCleanupService {
  private readonly logger = new Logger(AdminCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async purgeExpiredTokens(admin: JwtPayload): Promise<CleanupResult> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Delete expired tokens (past expiresAt)
    const expired = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Delete revoked tokens older than 7 days (kept for theft detection window)
    const revokedOld = await this.prisma.refreshToken.deleteMany({
      where: {
        revoked: true,
        revokedAt: { lt: sevenDaysAgo },
      },
    });

    const totalDeleted = expired.count + revokedOld.count;

    this.logger.log(
      `Purged ${totalDeleted} tokens (${expired.count} expired, ${revokedOld.count} revoked >7d)`,
    );

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'CLEANUP_TOKENS',
      resourceType: 'cleanup',
      details: {
        expiredDeleted: expired.count,
        revokedDeleted: revokedOld.count,
        totalDeleted,
      },
    });

    return {
      task: 'purge_expired_tokens',
      deletedCount: totalDeleted,
      details: {
        expiredTokens: expired.count,
        revokedTokensOlderThan7d: revokedOld.count,
      },
    };
  }

  async previewExpiredTokens(): Promise<{
    expiredCount: number;
    revokedOldCount: number;
    totalCleanable: number;
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [expiredCount, revokedOldCount] = await Promise.all([
      this.prisma.refreshToken.count({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.refreshToken.count({
        where: {
          revoked: true,
          revokedAt: { lt: sevenDaysAgo },
        },
      }),
    ]);

    return {
      expiredCount,
      revokedOldCount,
      totalCleanable: expiredCount + revokedOldCount,
    };
  }

  async purgeExpiredOtps(admin: JwtPayload): Promise<CleanupResult> {
    const now = new Date();

    // Delete expired OTPs (past expiresAt)
    const expired = await this.prisma.otpCode.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Delete used OTPs (already consumed, no purpose keeping them)
    const used = await this.prisma.otpCode.deleteMany({
      where: { usedAt: { not: null } },
    });

    const totalDeleted = expired.count + used.count;

    this.logger.log(
      `Purged ${totalDeleted} OTPs (${expired.count} expired, ${used.count} used)`,
    );

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'CLEANUP_OTPS',
      resourceType: 'cleanup',
      details: {
        expiredDeleted: expired.count,
        usedDeleted: used.count,
        totalDeleted,
      },
    });

    return {
      task: 'purge_expired_otps',
      deletedCount: totalDeleted,
      details: {
        expiredOtps: expired.count,
        usedOtps: used.count,
      },
    };
  }

  async previewExpiredOtps(): Promise<{
    expiredCount: number;
    usedCount: number;
    totalCleanable: number;
  }> {
    const now = new Date();

    const [expiredCount, usedCount] = await Promise.all([
      this.prisma.otpCode.count({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.otpCode.count({
        where: { usedAt: { not: null } },
      }),
    ]);

    return {
      expiredCount,
      usedCount,
      totalCleanable: expiredCount + usedCount,
    };
  }

  async purgeOldNotifications(admin: JwtPayload): Promise<CleanupResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Delete read notifications older than 30 days
    const readOld = await this.prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    // Delete unread notifications older than 90 days
    const unreadOld = await this.prisma.notification.deleteMany({
      where: {
        isRead: false,
        createdAt: { lt: ninetyDaysAgo },
      },
    });

    const totalDeleted = readOld.count + unreadOld.count;

    this.logger.log(
      `Purged ${totalDeleted} notifications (${readOld.count} read >30d, ${unreadOld.count} unread >90d)`,
    );

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'CLEANUP_NOTIFICATIONS',
      resourceType: 'cleanup',
      details: {
        readDeleted: readOld.count,
        unreadDeleted: unreadOld.count,
        totalDeleted,
      },
    });

    return {
      task: 'purge_old_notifications',
      deletedCount: totalDeleted,
      details: {
        readOlderThan30d: readOld.count,
        unreadOlderThan90d: unreadOld.count,
      },
    };
  }

  async previewOldNotifications(): Promise<{
    readOldCount: number;
    unreadOldCount: number;
    totalCleanable: number;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [readOldCount, unreadOldCount] = await Promise.all([
      this.prisma.notification.count({
        where: {
          isRead: true,
          createdAt: { lt: thirtyDaysAgo },
        },
      }),
      this.prisma.notification.count({
        where: {
          isRead: false,
          createdAt: { lt: ninetyDaysAgo },
        },
      }),
    ]);

    return {
      readOldCount,
      unreadOldCount,
      totalCleanable: readOldCount + unreadOldCount,
    };
  }

  async purgeOldReadingHistory(admin: JwtPayload): Promise<CleanupResult> {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const deleted = await this.prisma.readingHistory.deleteMany({
      where: { openedAt: { lt: oneYearAgo } },
    });

    this.logger.log(`Purged ${deleted.count} reading history records >1 year`);

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'CLEANUP_READING_HISTORY',
      resourceType: 'cleanup',
      details: { totalDeleted: deleted.count },
    });

    return {
      task: 'purge_old_reading_history',
      deletedCount: deleted.count,
      details: { olderThan365d: deleted.count },
    };
  }

  async previewOldReadingHistory(): Promise<{
    oldCount: number;
    totalCleanable: number;
  }> {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const oldCount = await this.prisma.readingHistory.count({
      where: { openedAt: { lt: oneYearAgo } },
    });

    return { oldCount, totalCleanable: oldCount };
  }
}
