import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChapterStatus, ReadingListVisibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AddToListDto } from './dto/add-to-list.dto';
import { CreateReadingListDto } from './dto/create-reading-list.dto';
import { UpdateReadingListDto } from './dto/update-reading-list.dto';

@Injectable()
export class ReadingListsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, novelId?: string) {
    const lists = await this.prisma.readingList.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: this.listInclude(false, novelId),
    });

    return lists.map((list) =>
      this.toReadingListResponse(list as never, false, novelId),
    );
  }

  async listPublicByUser(username: string) {
    const lists = await this.prisma.readingList.findMany({
      where: {
        visibility: ReadingListVisibility.PUBLIC,
        user: {
          username,
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: this.listInclude(false),
    });

    return lists.map((list) =>
      this.toReadingListResponse(list as never, false),
    );
  }

  async getDetail(id: string, viewerId?: string | null) {
    const list = await this.prisma.readingList.findUnique({
      where: { id },
      include: this.listInclude(true),
    });

    if (!list) {
      throw new NotFoundException({ statusCode: 404, message: 'Reading list not found', code: 'READING_LIST_NOT_FOUND' });
    }

    if (
      list.visibility === ReadingListVisibility.PRIVATE &&
      list.userId !== viewerId
    ) {
      throw new NotFoundException({ statusCode: 404, message: 'Reading list not found', code: 'READING_LIST_NOT_FOUND' });
    }

    return this.toReadingListResponse(list as never, true);
  }

  async create(userId: string, dto: CreateReadingListDto) {
    const list = await this.prisma.readingList.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        visibility: dto.visibility ?? ReadingListVisibility.PRIVATE,
      },
      include: this.listInclude(false),
    });

    return this.toReadingListResponse(list as never, false);
  }

  async update(userId: string, id: string, dto: UpdateReadingListDto) {
    const existing = await this.findOwnedList(id, userId);

    const list = await this.prisma.readingList.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
      },
      include: this.listInclude(false),
    });

    return this.toReadingListResponse(list as never, false);
  }

  async remove(userId: string, id: string) {
    const existing = await this.findOwnedList(id, userId);
    await this.prisma.readingList.delete({
      where: { id: existing.id },
    });

    return { message: 'Reading list deleted successfully' };
  }

  async addItem(userId: string, listId: string, dto: AddToListDto) {
    const list = await this.findOwnedList(listId, userId);
    const novel = await this.prisma.novel.findUnique({
      where: { id: dto.novel_id },
      include: {
        author: {
          include: { profile: true },
        },
        chapters: {
          where: { status: ChapterStatus.PUBLISHED },
          select: { id: true },
        },
        likes: {
          select: { id: true },
        },
      },
    });

    if (!novel) {
      throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    }

    if (list.visibility === ReadingListVisibility.PUBLIC && !novel.isPublic) {
      throw new BadRequestException({ statusCode: 400, message: 'You cannot add a private novel to a public list', code: 'PRIVATE_NOVEL_IN_PUBLIC_LIST' });
    }

    if (!novel.isPublic && novel.authorId !== userId) {
      throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    }

    const duplicate = await this.prisma.readingListItem.findUnique({
      where: {
        readingListId_novelId: {
          readingListId: listId,
          novelId: dto.novel_id,
        },
      },
    });

    if (duplicate) {
      throw new ConflictException({ statusCode: 409, message: 'Novel already exists in this list', code: 'NOVEL_ALREADY_IN_LIST' });
    }

    const item = await this.prisma.readingListItem.create({
      data: {
        readingListId: listId,
        novelId: dto.novel_id,
        personalNote: dto.personal_note?.trim() || null,
      },
      include: this.itemInclude(),
    });

    return this.toReadingListItemResponse(item);
  }

  async removeItem(userId: string, listId: string, novelId: string) {
    await this.findOwnedList(listId, userId);
    const item = await this.prisma.readingListItem.findUnique({
      where: {
        readingListId_novelId: {
          readingListId: listId,
          novelId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException({ statusCode: 404, message: 'Item not found', code: 'READING_LIST_ITEM_NOT_FOUND' });
    }

    await this.prisma.readingListItem.delete({
      where: { id: item.id },
    });

    return { message: 'Novel removed from list' };
  }

  async updateItemNote(
    userId: string,
    listId: string,
    novelId: string,
    personalNote?: string,
  ) {
    await this.findOwnedList(listId, userId);

    const item = await this.prisma.readingListItem.findUnique({
      where: {
        readingListId_novelId: {
          readingListId: listId,
          novelId,
        },
      },
      include: this.itemInclude(),
    });

    if (!item) {
      throw new NotFoundException({ statusCode: 404, message: 'Item not found', code: 'READING_LIST_ITEM_NOT_FOUND' });
    }

    const updated = await this.prisma.readingListItem.update({
      where: { id: item.id },
      data: {
        personalNote: personalNote?.trim() || null,
      },
      include: this.itemInclude(),
    });

    return this.toReadingListItemResponse(updated);
  }

  private async findOwnedList(id: string, userId: string) {
    const list = await this.prisma.readingList.findUnique({
      where: { id },
    });

    if (!list) {
      throw new NotFoundException({ statusCode: 404, message: 'Reading list not found', code: 'READING_LIST_NOT_FOUND' });
    }

    if (list.userId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot manage this list', code: 'READING_LIST_MANAGE_FORBIDDEN' });
    }

    return list;
  }

  private listInclude(includeItems: boolean, novelId?: string) {
    return {
      user: {
        include: {
          profile: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
      items: includeItems
        ? {
            orderBy: { addedAt: 'desc' as const },
            include: this.itemInclude(),
          }
        : novelId
          ? {
              where: { novelId },
              select: { id: true },
            }
          : false,
    };
  }

  private itemInclude() {
    return {
      novel: {
        include: {
          author: {
            include: { profile: true },
          },
          chapters: {
            where: { status: ChapterStatus.PUBLISHED },
            select: { id: true },
          },
          likes: {
            select: { id: true },
          },
        },
      },
    };
  }

  private toReadingListResponse(
    list: {
      id: string;
      name: string;
      description: string | null;
      visibility: ReadingListVisibility;
      createdAt: Date;
      updatedAt: Date;
      user: {
        username: string;
        profile: {
          displayName: string | null;
          avatarUrl: string | null;
        } | null;
      };
      _count: { items: number };
      items?: Array<
        | {
            id: string;
          }
        | {
            personalNote: string | null;
            addedAt: Date;
            novel: {
              id: string;
              slug: string;
              title: string;
              coverUrl: string | null;
              status: string;
              author: {
                username: string;
                profile: {
                  displayName: string | null;
                } | null;
              };
              chapters: Array<{ id: string }>;
              likes: Array<{ id: string }>;
            };
          }
      >;
    },
    includeItems: boolean,
    novelId?: string,
  ) {
    const detailedItems = includeItems
      ? (
          (list.items ?? []) as Array<{
            personalNote: string | null;
            addedAt: Date;
            novel: {
              id: string;
              slug: string;
              title: string;
              coverUrl: string | null;
              status: string;
              author: {
                username: string;
                profile: {
                  displayName: string | null;
                } | null;
              };
              chapters: Array<{ id: string }>;
              likes: Array<{ id: string }>;
            };
          }>
        ).map((item) => this.toReadingListItemResponse(item))
      : undefined;

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      visibility: list.visibility,
      created_at: list.createdAt,
      updated_at: list.updatedAt,
      owner: {
        username: list.user.username,
        display_name: list.user.profile?.displayName ?? list.user.username,
        avatar_url: list.user.profile?.avatarUrl ?? null,
      },
      items_count: list._count.items,
      ...(novelId ? { contains_novel: (list.items ?? []).length > 0 } : {}),
      ...(detailedItems ? { items: detailedItems } : {}),
    };
  }

  private toReadingListItemResponse(item: {
    personalNote: string | null;
    addedAt: Date;
    novel: {
      id: string;
      slug: string;
      title: string;
      coverUrl: string | null;
      status: string;
      author: {
        username: string;
        profile: {
          displayName: string | null;
        } | null;
      };
      chapters: Array<{ id: string }>;
      likes: Array<{ id: string }>;
    };
  }) {
    return {
      novel: {
        id: item.novel.id,
        slug: item.novel.slug,
        title: item.novel.title,
        cover_url: item.novel.coverUrl,
        status: item.novel.status,
        author: {
          username: item.novel.author.username,
          display_name:
            item.novel.author.profile?.displayName ??
            item.novel.author.username,
        },
        stats: {
          chapters_count: item.novel.chapters.length,
          likes_count: item.novel.likes.length,
        },
      },
      personal_note: item.personalNote,
      added_at: item.addedAt,
    };
  }
}
