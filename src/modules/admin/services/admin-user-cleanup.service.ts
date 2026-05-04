import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { Role } from '../../../common/constants/roles';

const BACKUP_EXPIRY_YEARS = 2;
const BACKUP_VERSION = 1;

export interface InactiveUserPreview {
  id: string;
  email: string;
  username: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  daysSinceLogin: number;
}

export interface UserCleanupResult {
  userId: string;
  username: string;
  backupId: string;
  backupSize: number;
  deletedCounts: Record<string, number>;
  totalDeleted: number;
}

@Injectable()
export class AdminUserCleanupService {
  private readonly logger = new Logger(AdminUserCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async previewInactiveUsers(inactiveDays: number): Promise<{
    users: InactiveUserPreview[];
    totalCount: number;
  }> {
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        lastLoginAt: { lt: cutoff },
        isActive: true,
        isAdmin: false,
        role: { lt: Role.ADMIN },
        // Exclude users with published content (non-draft novels, public worlds/characters)
        novels: { none: { status: { in: ['IN_PROGRESS', 'COMPLETED'] } } },
        worlds: { none: { visibility: 'PUBLIC' } },
        characters: { none: { isPublic: true } },
      },
      select: {
        id: true,
        email: true,
        username: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { lastLoginAt: 'asc' },
      take: 100,
    });

    const now = Date.now();
    const mapped = users.map((u) => ({
      ...u,
      daysSinceLogin: u.lastLoginAt
        ? Math.floor((now - u.lastLoginAt.getTime()) / (24 * 60 * 60 * 1000))
        : Math.floor((now - u.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    }));

    return { users: mapped, totalCount: mapped.length };
  }

  async cleanupUser(userId: string, admin: JwtPayload): Promise<UserCleanupResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, isAdmin: true, role: true },
    });

    if (!user) {
      throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    // Collect data for backup before deleting
    const backupData = await this.collectUserData(userId);
    const backupJson = JSON.stringify(backupData);
    const backupSize = Buffer.byteLength(backupJson, 'utf8');

    // Save backup
    const backup = await this.prisma.userDataBackup.create({
      data: {
        userId,
        data: backupData as unknown as Prisma.InputJsonValue,
        dataSize: backupSize,
        version: BACKUP_VERSION,
        expiresAt: new Date(Date.now() + BACKUP_EXPIRY_YEARS * 365 * 24 * 60 * 60 * 1000),
      },
    });

    // Delete data in phases
    const counts: Record<string, number> = {};

    // Phase 1: Session
    counts.refreshTokens = (await this.prisma.refreshToken.deleteMany({ where: { userId } })).count;
    counts.otpCodes = (await this.prisma.otpCode.deleteMany({ where: { userId } })).count;

    // Phase 2: Ephemeral
    counts.notifications = (await this.prisma.notification.deleteMany({ where: { userId } })).count;
    counts.searchHistory = (await this.prisma.searchHistory.deleteMany({ where: { userId } })).count;
    counts.notificationPrefs = (await this.prisma.notificationPreferences.deleteMany({ where: { userId } })).count;
    counts.privacySettings = (await this.prisma.privacySettings.deleteMany({ where: { userId } })).count;

    // Phase 3: Reading (ReadingList cascades to ReadingListItem)
    counts.readingLists = (await this.prisma.readingList.deleteMany({ where: { userId } })).count;
    counts.readingProgress = (await this.prisma.readingProgress.deleteMany({ where: { userId } })).count;
    counts.readingHistory = (await this.prisma.readingHistory.deleteMany({ where: { userId } })).count;
    counts.bookmarks = (await this.prisma.chapterBookmark.deleteMany({ where: { userId } })).count;
    counts.highlights = (await this.prisma.highlight.deleteMany({ where: { userId } })).count;
    counts.readerPrefs = (await this.prisma.readerPreferences.deleteMany({ where: { userId } })).count;
    counts.readingGoals = (await this.prisma.readingGoal.deleteMany({ where: { userId } })).count;

    // Phase 4: Author tools (cascade: Board→Section→Item, Project→Task, Timeline→Event)
    counts.visualBoards = (await this.prisma.visualBoard.deleteMany({ where: { authorId: userId } })).count;
    counts.writingProjects = (await this.prisma.writingProject.deleteMany({ where: { authorId: userId } })).count;
    counts.timelines = (await this.prisma.timeline.deleteMany({ where: { authorId: userId } })).count;

    // Phase 5: Engagement
    counts.reactions = (await this.prisma.reaction.deleteMany({ where: { userId } })).count;
    counts.forumReactions = (await this.prisma.forumReaction.deleteMany({ where: { userId } })).count;
    counts.novelKudos = (await this.prisma.novelKudo.deleteMany({ where: { userId } })).count;
    counts.characterKudos = (await this.prisma.characterKudo.deleteMany({ where: { userId } })).count;
    counts.worldKudos = (await this.prisma.worldKudo.deleteMany({ where: { userId } })).count;
    counts.chapterVotes = (await this.prisma.chapterVote.deleteMany({ where: { userId } })).count;
    counts.novelSubscriptions = (await this.prisma.novelSubscription.deleteMany({ where: { userId } })).count;
    counts.savedPosts = (await this.prisma.savedPost.deleteMany({ where: { userId } })).count;

    // Deactivate user
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, status: 'SUSPENDED', role: Role.USER },
    });

    const totalDeleted = Object.values(counts).reduce((a, b) => a + b, 0);

    this.logger.log(
      `Cleaned inactive user ${user.username} (${userId}): ${totalDeleted} records deleted, backup ${backup.id} (${backupSize} bytes)`,
    );

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'CLEANUP_INACTIVE_USER',
      resourceType: 'user',
      resourceId: userId,
      details: { username: user.username, email: user.email, totalDeleted, backupId: backup.id, backupSize },
    });

    return {
      userId,
      username: user.username,
      backupId: backup.id,
      backupSize,
      deletedCounts: counts,
      totalDeleted,
    };
  }

  async restoreUser(userId: string, admin: JwtPayload): Promise<{ restored: number }> {
    const backup = await this.prisma.userDataBackup.findFirst({
      where: { userId, restoredAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!backup) {
      throw new NotFoundException({ statusCode: 404, message: 'No backup found for this user', code: 'BACKUP_NOT_FOUND' });
    }

    const data = backup.data as Record<string, unknown[]>;
    let restored = 0;

    // Restore in reverse phase order
    // Phase 2: Ephemeral
    if (data.notifications?.length) {
      await this.prisma.notification.createMany({ data: data.notifications as any[], skipDuplicates: true });
      restored += data.notifications.length;
    }
    if (data.searchHistory?.length) {
      await this.prisma.searchHistory.createMany({ data: data.searchHistory as any[], skipDuplicates: true });
      restored += data.searchHistory.length;
    }

    // Phase 3: Reading
    if (data.readingProgress?.length) {
      await this.prisma.readingProgress.createMany({ data: data.readingProgress as any[], skipDuplicates: true });
      restored += data.readingProgress.length;
    }
    if (data.readingHistory?.length) {
      await this.prisma.readingHistory.createMany({ data: data.readingHistory as any[], skipDuplicates: true });
      restored += data.readingHistory.length;
    }
    if (data.bookmarks?.length) {
      await this.prisma.chapterBookmark.createMany({ data: data.bookmarks as any[], skipDuplicates: true });
      restored += data.bookmarks.length;
    }
    if (data.highlights?.length) {
      await this.prisma.highlight.createMany({ data: data.highlights as any[], skipDuplicates: true });
      restored += data.highlights.length;
    }

    // Reactivate user
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true, status: 'ACTIVE' },
    });

    // Mark backup as restored
    await this.prisma.userDataBackup.update({
      where: { id: backup.id },
      data: { restoredAt: new Date() },
    });

    this.logger.log(`Restored user ${userId}: ${restored} records from backup ${backup.id}`);

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'RESTORE_INACTIVE_USER',
      resourceType: 'user',
      resourceId: userId,
      details: { backupId: backup.id, restoredCount: restored },
    });

    return { restored };
  }

  async cleanupAllInactive(inactiveDays: number, admin: JwtPayload): Promise<{
    usersProcessed: number;
    totalDeleted: number;
    results: Array<{ userId: string; username: string; deleted: number }>;
  }> {
    const { users } = await this.previewInactiveUsers(inactiveDays);
    const results: Array<{ userId: string; username: string; deleted: number }> = [];
    let totalDeleted = 0;

    for (const candidate of users) {
      const result = await this.cleanupUser(candidate.id, admin);
      results.push({
        userId: result.userId,
        username: result.username,
        deleted: result.totalDeleted,
      });
      totalDeleted += result.totalDeleted;
    }

    return { usersProcessed: results.length, totalDeleted, results };
  }

  private async collectUserData(userId: string): Promise<Record<string, unknown[]>> {
    const [
      notifications, searchHistory, readingProgress, readingHistory,
      bookmarks, highlights, readingGoals, savedPosts,
    ] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId } }),
      this.prisma.searchHistory.findMany({ where: { userId } }),
      this.prisma.readingProgress.findMany({ where: { userId } }),
      this.prisma.readingHistory.findMany({ where: { userId } }),
      this.prisma.chapterBookmark.findMany({ where: { userId } }),
      this.prisma.highlight.findMany({ where: { userId } }),
      this.prisma.readingGoal.findMany({ where: { userId } }),
      this.prisma.savedPost.findMany({ where: { userId } }),
    ]);

    return {
      notifications, searchHistory, readingProgress, readingHistory,
      bookmarks, highlights, readingGoals, savedPosts,
    };
  }
}
