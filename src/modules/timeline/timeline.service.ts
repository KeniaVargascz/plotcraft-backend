import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { UpdateTimelineDto } from './dto/update-timeline.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { ReorderEventsDto } from './dto/reorder-events.dto';

type TimelineReferenceCategory = {
  name: string;
  icon: string | null;
  color: string | null;
};

type TimelineEventView = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  relevance: string;
  dateLabel: string | null;
  sortOrder: number;
  color: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  chapter: { id: string; slug: string; title: string; order: number } | null;
  character: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  world: { id: string; slug: string; name: string } | null;
  wbEntry: {
    id: string;
    slug: string;
    name: string;
    category: TimelineReferenceCategory;
  } | null;
};

type TimelineSummaryView = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  novel: { id: string; slug: string; title: string } | null;
  _count: { events: number };
};

type TimelineDetailView = TimelineSummaryView & {
  events: TimelineEventView[];
};

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Timeline CRUD ──

  async listTimelines(userId: string) {
    const timelines = await this.prisma.timeline.findMany({
      where: { authorId: userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        _count: { select: { events: true } },
      },
    });

    return timelines.map((t) => this.toTimelineSummary(t));
  }

  async createTimeline(userId: string, dto: CreateTimelineDto) {
    if (dto.novelId) {
      await this.verifyNovelOwnership(dto.novelId, userId);
    }

    const timeline = await this.prisma.timeline.create({
      data: {
        authorId: userId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        novelId: dto.novelId ?? null,
      },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        _count: { select: { events: true } },
      },
    });

    return this.toTimelineSummary(timeline);
  }

  async getTimeline(id: string, userId: string) {
    const timeline = await this.prisma.timeline.findFirst({
      where: { id, authorId: userId },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        _count: { select: { events: true } },
        events: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapter: {
              select: { id: true, slug: true, title: true, order: true },
            },
            character: {
              select: { id: true, slug: true, name: true, avatarUrl: true },
            },
            world: { select: { id: true, slug: true, name: true } },
            wbEntry: {
              select: {
                id: true,
                slug: true,
                name: true,
                category: { select: { name: true, icon: true, color: true } },
              },
            },
          },
        },
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    return this.toTimelineDetail(timeline);
  }

  async updateTimeline(id: string, userId: string, dto: UpdateTimelineDto) {
    await this.verifyTimelineOwnership(id, userId);

    if (dto.novelId) {
      await this.verifyNovelOwnership(dto.novelId, userId);
    }

    const timeline = await this.prisma.timeline.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.novelId !== undefined ? { novelId: dto.novelId } : {}),
      },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        _count: { select: { events: true } },
      },
    });

    return this.toTimelineSummary(timeline);
  }

  async deleteTimeline(id: string, userId: string, confirm: boolean) {
    await this.verifyTimelineOwnership(id, userId);

    const eventCount = await this.prisma.timelineEvent.count({
      where: { timelineId: id },
    });

    if (eventCount > 50 && !confirm) {
      throw new BadRequestException(
        `This timeline has ${eventCount} events. Pass confirm: true to delete.`,
      );
    }

    await this.prisma.timeline.delete({ where: { id } });
    return { message: 'Timeline deleted successfully' };
  }

  async upsertByNovel(novelSlug: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug: novelSlug },
    });

    if (!novel) {
      throw new NotFoundException('Novel not found');
    }

    if (novel.authorId !== userId) {
      throw new ForbiddenException('You do not own this novel');
    }

    let timeline = await this.prisma.timeline.findFirst({
      where: { authorId: userId, novelId: novel.id },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        _count: { select: { events: true } },
        events: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapter: {
              select: { id: true, slug: true, title: true, order: true },
            },
            character: {
              select: { id: true, slug: true, name: true, avatarUrl: true },
            },
            world: { select: { id: true, slug: true, name: true } },
            wbEntry: {
              select: {
                id: true,
                slug: true,
                name: true,
                category: { select: { name: true, icon: true, color: true } },
              },
            },
          },
        },
      },
    });

    if (!timeline) {
      timeline = await this.prisma.timeline.create({
        data: {
          authorId: userId,
          novelId: novel.id,
          name: `${novel.title} \u2014 Timeline`,
        },
        include: {
          novel: { select: { id: true, slug: true, title: true } },
          _count: { select: { events: true } },
          events: {
            orderBy: { sortOrder: 'asc' },
            include: {
              chapter: {
                select: { id: true, slug: true, title: true, order: true },
              },
              character: {
                select: { id: true, slug: true, name: true, avatarUrl: true },
              },
              world: { select: { id: true, slug: true, name: true } },
              wbEntry: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  category: { select: { name: true, icon: true, color: true } },
                },
              },
            },
          },
        },
      });
    }

    return this.toTimelineDetail(timeline);
  }

  // ── Event CRUD ──

  async createEvent(timelineId: string, userId: string, dto: CreateEventDto) {
    await this.verifyTimelineOwnership(timelineId, userId);

    if (dto.chapterId) {
      await this.verifyChapterOwnership(dto.chapterId, userId);
    }
    if (dto.characterId) {
      await this.verifyCharacterOwnership(dto.characterId, userId);
    }
    if (dto.worldId) {
      await this.verifyWorldOwnership(dto.worldId, userId);
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await this.prisma.timelineEvent.aggregate({
        where: { timelineId },
        _max: { sortOrder: true },
      });
      sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;
    }

    const event = await this.prisma.timelineEvent.create({
      data: {
        timelineId,
        authorId: userId,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        type: dto.type ?? 'STORY_EVENT',
        relevance: dto.relevance ?? 'MINOR',
        dateLabel: dto.dateLabel?.trim() ?? null,
        sortOrder,
        color: dto.color ?? null,
        tags: dto.tags?.map((t) => t.trim()).filter(Boolean) ?? [],
        chapterId: dto.chapterId ?? null,
        characterId: dto.characterId ?? null,
        worldId: dto.worldId ?? null,
        wbEntryId: dto.wbEntryId ?? null,
      },
      include: {
        chapter: { select: { id: true, slug: true, title: true, order: true } },
        character: {
          select: { id: true, slug: true, name: true, avatarUrl: true },
        },
        world: { select: { id: true, slug: true, name: true } },
        wbEntry: {
          select: {
            id: true,
            slug: true,
            name: true,
            category: { select: { name: true, icon: true, color: true } },
          },
        },
      },
    });

    return this.toEventResponse(event);
  }

  async updateEvent(
    timelineId: string,
    eventId: string,
    userId: string,
    dto: UpdateEventDto,
  ) {
    await this.verifyTimelineOwnership(timelineId, userId);

    const event = await this.prisma.timelineEvent.findFirst({
      where: { id: eventId, timelineId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (dto.chapterId) {
      await this.verifyChapterOwnership(dto.chapterId, userId);
    }
    if (dto.characterId) {
      await this.verifyCharacterOwnership(dto.characterId, userId);
    }
    if (dto.worldId) {
      await this.verifyWorldOwnership(dto.worldId, userId);
    }

    const updated = await this.prisma.timelineEvent.update({
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.relevance !== undefined ? { relevance: dto.relevance } : {}),
        ...(dto.dateLabel !== undefined
          ? { dateLabel: dto.dateLabel?.trim() ?? null }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.color !== undefined ? { color: dto.color ?? null } : {}),
        ...(dto.tags !== undefined
          ? { tags: dto.tags.map((t) => t.trim()).filter(Boolean) }
          : {}),
        ...(dto.chapterId !== undefined ? { chapterId: dto.chapterId } : {}),
        ...(dto.characterId !== undefined
          ? { characterId: dto.characterId }
          : {}),
        ...(dto.worldId !== undefined ? { worldId: dto.worldId } : {}),
        ...(dto.wbEntryId !== undefined ? { wbEntryId: dto.wbEntryId } : {}),
      },
      include: {
        chapter: { select: { id: true, slug: true, title: true, order: true } },
        character: {
          select: { id: true, slug: true, name: true, avatarUrl: true },
        },
        world: { select: { id: true, slug: true, name: true } },
        wbEntry: {
          select: {
            id: true,
            slug: true,
            name: true,
            category: { select: { name: true, icon: true, color: true } },
          },
        },
      },
    });

    return this.toEventResponse(updated);
  }

  async deleteEvent(timelineId: string, eventId: string, userId: string) {
    await this.verifyTimelineOwnership(timelineId, userId);

    const event = await this.prisma.timelineEvent.findFirst({
      where: { id: eventId, timelineId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    await this.prisma.timelineEvent.delete({ where: { id: eventId } });
    return { message: 'Event deleted successfully' };
  }

  async reorderEvents(
    timelineId: string,
    userId: string,
    dto: ReorderEventsDto,
  ) {
    await this.verifyTimelineOwnership(timelineId, userId);

    await this.prisma.$transaction(
      dto.events.map((item) =>
        this.prisma.timelineEvent.updateMany({
          where: { id: item.id, timelineId },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    return { reordered: true };
  }

  async listEvents(timelineId: string, userId: string, query: EventQueryDto) {
    await this.verifyTimelineOwnership(timelineId, userId);
    const limit = query.limit ?? 20;

    const where: Prisma.TimelineEventWhereInput = {
      timelineId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.relevance ? { relevance: query.relevance } : {}),
      ...(query.characterId ? { characterId: query.characterId } : {}),
      ...(query.chapterId ? { chapterId: query.chapterId } : {}),
      ...(query.worldId ? { worldId: query.worldId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                title: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                dateLabel: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const orderByMap: Record<
      string,
      Prisma.TimelineEventOrderByWithRelationInput
    > = {
      order: { sortOrder: 'asc' },
      type: { type: 'asc' },
      relevance: { relevance: 'asc' },
    };

    const events = await this.prisma.timelineEvent.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: orderByMap[query.sort ?? 'order'],
      include: {
        chapter: { select: { id: true, slug: true, title: true, order: true } },
        character: {
          select: { id: true, slug: true, name: true, avatarUrl: true },
        },
        world: { select: { id: true, slug: true, name: true } },
        wbEntry: {
          select: {
            id: true,
            slug: true,
            name: true,
            category: { select: { name: true, icon: true, color: true } },
          },
        },
      },
    });

    const hasMore = events.length > limit;
    const items = events.slice(0, limit);

    return {
      data: items.map((e) => this.toEventResponse(e)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async exportTimeline(id: string, userId: string) {
    const timeline = await this.prisma.timeline.findFirst({
      where: { id, authorId: userId },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        events: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapter: {
              select: { id: true, slug: true, title: true, order: true },
            },
            character: { select: { id: true, slug: true, name: true } },
            world: { select: { id: true, slug: true, name: true } },
            wbEntry: {
              select: {
                id: true,
                slug: true,
                name: true,
                category: { select: { name: true, icon: true, color: true } },
              },
            },
          },
        },
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    return {
      export_version: 1,
      exported_at: new Date().toISOString(),
      timeline: {
        name: timeline.name,
        description: timeline.description,
        novel: timeline.novel
          ? {
              id: timeline.novel.id,
              slug: timeline.novel.slug,
              title: timeline.novel.title,
            }
          : null,
      },
      events: timeline.events.map((e) => ({
        sortOrder: e.sortOrder,
        dateLabel: e.dateLabel,
        title: e.title,
        description: e.description,
        type: e.type,
        relevance: e.relevance,
        tags: e.tags,
        references: {
          chapter: e.chapter
            ? { id: e.chapter.id, slug: e.chapter.slug, title: e.chapter.title }
            : null,
          character: e.character
            ? {
                id: e.character.id,
                slug: e.character.slug,
                name: e.character.name,
              }
            : null,
          world: e.world
            ? { id: e.world.id, slug: e.world.slug, name: e.world.name }
            : null,
          wbEntry: e.wbEntry
            ? {
                id: e.wbEntry.id,
                slug: e.wbEntry.slug,
                name: e.wbEntry.name,
                category: e.wbEntry.category,
              }
            : null,
        },
      })),
    };
  }

  // ── Helpers ──

  private toEventResponse(event: TimelineEventView) {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      type: event.type,
      relevance: event.relevance,
      dateLabel: event.dateLabel,
      sortOrder: event.sortOrder,
      color: event.color,
      tags: event.tags,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      chapter: event.chapter
        ? {
            id: event.chapter.id,
            slug: event.chapter.slug,
            title: event.chapter.title,
            order: event.chapter.order,
          }
        : null,
      character: event.character
        ? {
            id: event.character.id,
            slug: event.character.slug,
            name: event.character.name,
            avatarUrl: event.character.avatarUrl,
          }
        : null,
      world: event.world
        ? {
            id: event.world.id,
            slug: event.world.slug,
            name: event.world.name,
          }
        : null,
      wbEntry: event.wbEntry
        ? {
            id: event.wbEntry.id,
            slug: event.wbEntry.slug,
            name: event.wbEntry.name,
            category: event.wbEntry.category,
          }
        : null,
    };
  }

  private toTimelineSummary(timeline: TimelineSummaryView) {
    return {
      id: timeline.id,
      name: timeline.name,
      description: timeline.description,
      createdAt: timeline.createdAt,
      updatedAt: timeline.updatedAt,
      novel: timeline.novel
        ? {
            id: timeline.novel.id,
            slug: timeline.novel.slug,
            title: timeline.novel.title,
          }
        : null,
      eventsCount: timeline._count.events,
    };
  }

  private toTimelineDetail(timeline: TimelineDetailView) {
    return {
      ...this.toTimelineSummary(timeline),
      events: timeline.events.map((event) => this.toEventResponse(event)),
    };
  }

  // ── Ownership Verification ──

  private async verifyTimelineOwnership(timelineId: string, userId: string) {
    const timeline = await this.prisma.timeline.findFirst({
      where: { id: timelineId, authorId: userId },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    return timeline;
  }

  private async verifyNovelOwnership(novelId: string, userId: string) {
    const novel = await this.prisma.novel.findFirst({
      where: { id: novelId, authorId: userId },
    });

    if (!novel) {
      throw new NotFoundException('Novel not found or not owned by user');
    }

    return novel;
  }

  private async verifyChapterOwnership(chapterId: string, userId: string) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, novel: { authorId: userId } },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found or not owned by user');
    }

    return chapter;
  }

  private async verifyCharacterOwnership(characterId: string, userId: string) {
    const character = await this.prisma.character.findFirst({
      where: { id: characterId, authorId: userId },
    });

    if (!character) {
      throw new NotFoundException('Character not found or not owned by user');
    }

    return character;
  }

  private async verifyWorldOwnership(worldId: string, userId: string) {
    const world = await this.prisma.world.findFirst({
      where: { id: worldId, authorId: userId },
    });

    if (!world) {
      throw new NotFoundException('World not found or not owned by user');
    }

    return world;
  }
}
