import { Injectable } from '@nestjs/common';
import { PrivacySettings } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePrivacySettingsDto } from './dto/privacy-settings.dto';
import { UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Privacy Settings ──

  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    return this.prisma.privacySettings.upsert({
      where: { userId },
      create: {
        userId,
        showReadingActivity: true,
        showReadingLists: true,
        showFollows: true,
        showStats: true,
        allowMessages: true,
        searchable: true,
      },
      update: {},
    });
  }

  async getPrivacy(userId: string) {
    return this.getPrivacySettings(userId);
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacySettingsDto) {
    return this.prisma.privacySettings.upsert({
      where: { userId },
      create: {
        userId,
        showReadingActivity: dto.showReadingActivity ?? true,
        showReadingLists: dto.showReadingLists ?? true,
        showFollows: dto.showFollows ?? true,
        showStats: dto.showStats ?? true,
        allowMessages: dto.allowMessages ?? true,
        searchable: dto.searchable ?? true,
      },
      update: {
        ...(dto.showReadingActivity !== undefined && {
          showReadingActivity: dto.showReadingActivity,
        }),
        ...(dto.showReadingLists !== undefined && {
          showReadingLists: dto.showReadingLists,
        }),
        ...(dto.showFollows !== undefined && {
          showFollows: dto.showFollows,
        }),
        ...(dto.showStats !== undefined && {
          showStats: dto.showStats,
        }),
        ...(dto.allowMessages !== undefined && {
          allowMessages: dto.allowMessages,
        }),
        ...(dto.searchable !== undefined && {
          searchable: dto.searchable,
        }),
      },
    });
  }

  // ── Notification Preferences ──

  async getNotificationPreferences(userId: string) {
    return this.prisma.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        newFollower: true,
        newCommentOnPost: true,
        newReactionOnPost: false,
        newReplyInThread: true,
        newChapterFromFollowed: true,
        novelMilestone: true,
        channel: 'IN_APP',
      },
      update: {},
    });
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    return this.prisma.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        newFollower: dto.newFollower ?? true,
        newCommentOnPost: dto.newCommentOnPost ?? true,
        newReactionOnPost: dto.newReactionOnPost ?? false,
        newReplyInThread: dto.newReplyInThread ?? true,
        newChapterFromFollowed: dto.newChapterFromFollowed ?? true,
        novelMilestone: dto.novelMilestone ?? true,
        channel: dto.channel ?? 'IN_APP',
      },
      update: {
        ...(dto.newFollower !== undefined && {
          newFollower: dto.newFollower,
        }),
        ...(dto.newCommentOnPost !== undefined && {
          newCommentOnPost: dto.newCommentOnPost,
        }),
        ...(dto.newReactionOnPost !== undefined && {
          newReactionOnPost: dto.newReactionOnPost,
        }),
        ...(dto.newReplyInThread !== undefined && {
          newReplyInThread: dto.newReplyInThread,
        }),
        ...(dto.newChapterFromFollowed !== undefined && {
          newChapterFromFollowed: dto.newChapterFromFollowed,
        }),
        ...(dto.novelMilestone !== undefined && {
          novelMilestone: dto.novelMilestone,
        }),
        ...(dto.channel !== undefined && {
          channel: dto.channel,
        }),
      },
    });
  }

  // ── Data Export ──

  async exportData(userId: string): Promise<object> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, username: true, createdAt: true },
    });

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        displayName: true,
        bio: true,
        website: true,
        isPublic: true,
        createdAt: true,
      },
    });

    const novels = await this.prisma.novel.findMany({
      where: { authorId: userId },
      select: {
        title: true,
        slug: true,
        status: true,
        synopsis: true,
        createdAt: true,
        wordCount: true,
        _count: { select: { chapters: true } },
      },
    });

    const worlds = await this.prisma.world.findMany({
      where: { authorId: userId },
      select: {
        name: true,
        slug: true,
        visibility: true,
        createdAt: true,
      },
    });

    const characters = await this.prisma.character.findMany({
      where: { authorId: userId },
      select: {
        name: true,
        slug: true,
        role: true,
        createdAt: true,
      },
    });

    const posts = await this.prisma.post.findMany({
      where: { authorId: userId, deletedAt: null },
      select: {
        content: true,
        type: true,
        createdAt: true,
      },
    });

    const novelsStarted = await this.prisma.readingProgress.findMany({
      where: { userId },
      distinct: ['novelId'],
      select: { novelId: true },
    });

    const totalChaptersRead = await this.prisma.readingHistory.count({
      where: { userId },
    });

    const privacySettings = await this.getPrivacySettings(userId);

    const notificationPreferences =
      await this.getNotificationPreferences(userId);

    const followersCount = await this.prisma.follow.count({
      where: { followingId: userId },
    });

    const followingCount = await this.prisma.follow.count({
      where: { followerId: userId },
    });

    const totalPosts = await this.prisma.post.count({
      where: { authorId: userId, deletedAt: null },
    });

    const totalForumThreads = await this.prisma.forumThread.count({
      where: { authorId: userId, deletedAt: null },
    });

    return {
      export_version: 1,
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      profile: profile
        ? {
            displayName: profile.displayName,
            bio: profile.bio,
            website: profile.website,
            isPublic: profile.isPublic,
            createdAt: profile.createdAt,
          }
        : null,
      novels: novels.map((n) => ({
        title: n.title,
        slug: n.slug,
        status: n.status,
        synopsis: n.synopsis,
        createdAt: n.createdAt,
        chaptersCount: n._count.chapters,
        wordCount: n.wordCount,
      })),
      worlds: worlds.map((w) => ({
        name: w.name,
        slug: w.slug,
        visibility: w.visibility,
        createdAt: w.createdAt,
      })),
      characters: characters.map((c) => ({
        name: c.name,
        slug: c.slug,
        role: c.role,
        createdAt: c.createdAt,
      })),
      posts: posts.map((p) => ({
        content: p.content,
        type: p.type,
        createdAt: p.createdAt,
      })),
      readingHistorySummary: {
        novelsStarted: novelsStarted.length,
        novelsCompleted: 0,
        totalChaptersRead,
      },
      privacySettings,
      notificationPreferences,
      accountStats: {
        followersCount,
        followingCount,
        totalPosts,
        totalForumThreads,
      },
    };
  }
}
