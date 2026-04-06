import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostType, Prisma, ReactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';

type ListPostsOptions = {
  query: PostQueryDto;
  viewerId?: string | null;
  authorIds?: string[];
  onlySavedByUserId?: string;
};

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPost(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        content: dto.content.trim(),
        type: dto.type ?? PostType.TEXT,
        imageUrls: dto.image_urls ?? [],
        tags:
          dto.tags
            ?.map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
            .filter(Boolean) ?? [],
      },
    });

    return this.getPostById(post.id, userId);
  }

  async listPosts(options: ListPostsOptions) {
    const limit = options.query.limit ?? 20;
    const cursorPost = options.query.cursor
      ? await this.prisma.post.findUnique({
          where: { id: options.query.cursor },
        })
      : null;

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      ...(options.query.type ? { type: options.query.type } : {}),
      ...(options.query.search
        ? {
            OR: [
              {
                content: {
                  contains: options.query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                tags: {
                  has: options.query.search.toLowerCase().replace(/\s+/g, '-'),
                },
              },
            ],
          }
        : {}),
      ...(options.query.tags?.length
        ? { tags: { hasEvery: options.query.tags } }
        : {}),
      ...(options.authorIds ? { authorId: { in: options.authorIds } } : {}),
      ...(options.onlySavedByUserId
        ? {
            savedBy: {
              some: {
                userId: options.onlySavedByUserId,
              },
            },
          }
        : {}),
    };

    if (options.query.author) {
      where.author = {
        username: options.query.author,
      };
    }

    if (cursorPost) {
      where.createdAt = { lt: cursorPost.createdAt };
    }

    const posts = await this.prisma.post.findMany({
      where,
      include: this.postInclude(options.viewerId),
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const trimmed = posts.slice(0, limit);

    return {
      data: trimmed.map((post) => this.toPostResponse(post, options.viewerId)),
      pagination: {
        nextCursor: posts.length > limit ? (trimmed.at(-1)?.id ?? null) : null,
        hasMore: posts.length > limit,
        limit,
      },
    };
  }

  async getPostById(id: string, viewerId?: string | null) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: this.postInclude(viewerId),
    });

    if (!post) {
      throw new NotFoundException('Publicacion no encontrada');
    }

    return this.toPostResponse(post, viewerId);
  }

  async updatePost(postId: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Publicacion no encontrada');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('No puedes editar esta publicacion');
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        content: dto.content.trim(),
      },
    });

    return this.getPostById(postId, userId);
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Publicacion no encontrada');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('No puedes eliminar esta publicacion');
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        deletedAt: new Date(),
      },
    });

    return { message: 'Publicacion eliminada' };
  }

  async savePost(postId: string, userId: string) {
    await this.ensurePostExists(postId);

    await this.prisma.savedPost.upsert({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
      update: {},
      create: {
        postId,
        userId,
      },
    });

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        isSaved: true,
      },
    });

    return { saved: true };
  }

  async unsavePost(postId: string, userId: string) {
    await this.prisma.savedPost.deleteMany({
      where: {
        postId,
        userId,
      },
    });

    return { saved: false };
  }

  private async ensurePostExists(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Publicacion no encontrada');
    }
  }

  private postInclude(viewerId?: string | null) {
    return {
      author: {
        include: {
          profile: true,
        },
      },
      reactions: true,
      comments: {
        where: { deletedAt: null },
        select: { id: true },
      },
      savedBy: viewerId
        ? {
            where: { userId: viewerId },
            select: { id: true },
          }
        : {
            select: { id: true },
          },
      _count: {
        select: {
          comments: true,
          reactions: true,
        },
      },
    } satisfies Prisma.PostInclude;
  }

  private toPostResponse(
    post: Prisma.PostGetPayload<{
      include: {
        author: { include: { profile: true } };
        reactions: true;
        comments: { select: { id: true } };
        savedBy: { select: { id: true } };
        _count: { select: { comments: true; reactions: true } };
      };
    }>,
    viewerId?: string | null,
  ) {
    const summary = {
      LIKE: 0,
      LOVE: 0,
      FIRE: 0,
      CLAP: 0,
    } satisfies Record<ReactionType, number>;

    let viewerReaction: ReactionType | null = null;

    post.reactions.forEach((reaction) => {
      summary[reaction.reactionType] += 1;
      if (viewerId && reaction.userId === viewerId) {
        viewerReaction = reaction.reactionType;
      }
    });

    const hasComments = post._count.comments > 0;

    return {
      id: post.id,
      content:
        post.deletedAt && hasComments ? '[Post eliminado]' : post.content,
      type: post.type,
      imageUrls: post.imageUrls,
      tags: post.tags,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.author.id,
        username: post.author.username,
        displayName: post.author.profile?.displayName ?? null,
        avatarUrl: post.author.profile?.avatarUrl ?? null,
      },
      stats: {
        commentsCount: post._count.comments,
        reactionsCount: post._count.reactions,
        reactionsSummary: summary,
      },
      viewerContext: viewerId
        ? {
            hasReacted: viewerReaction !== null,
            reactionType: viewerReaction,
            hasSaved: post.savedBy.length > 0,
          }
        : null,
    };
  }
}
