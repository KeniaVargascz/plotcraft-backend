import {
  BadRequestException,
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
    await this.validateContentLinking(userId, dto);

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
        novelId: dto.novel_id ?? null,
        chapterId: dto.chapter_id ?? null,
        worldId: dto.world_id ?? null,
        characterIds: dto.character_ids ?? [],
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
    const charMap = await this.fetchCharacterMap(trimmed);

    return {
      data: trimmed.map((post) =>
        this.toPostResponse(post, options.viewerId, charMap),
      ),
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

    const charMap = await this.fetchCharacterMap([post]);
    return this.toPostResponse(post, viewerId, charMap);
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
          privacySettings: { select: { allowPostComments: true } },
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
      novel: {
        select: {
          id: true,
          title: true,
          slug: true,
          synopsis: true,
          coverUrl: true,
          status: true,
          chaptersCount: true,
          author: {
            select: {
              id: true,
              username: true,
              profile: {
                select: { displayName: true, avatarUrl: true },
              },
            },
          },
        },
      },
      chapter: {
        select: {
          id: true,
          title: true,
          slug: true,
          order: true,
          wordCount: true,
          publishedAt: true,
          novel: {
            select: { id: true, title: true, slug: true },
          },
        },
      },
      world: {
        select: {
          id: true,
          name: true,
          slug: true,
          tagline: true,
          coverUrl: true,
          genre: true,
        },
      },
    } satisfies Prisma.PostInclude;
  }

  private toPostResponse(
    post: PostWithIncludes,
    viewerId?: string | null,
    characterMap?: Map<string, CharacterLinked>,
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
      commentsEnabled: post.author.privacySettings?.allowPostComments ?? true,
      linkedContent: this.buildLinkedContent(post, characterMap),
    };
  }

  private buildLinkedContent(
    post: PostWithIncludes,
    characterMap?: Map<string, CharacterLinked>,
  ) {
    const hasLinked =
      post.novel || post.chapter || post.world || post.characterIds.length > 0;
    if (!hasLinked) return null;

    return {
      novel: post.novel
        ? {
            id: post.novel.id,
            title: post.novel.title,
            slug: post.novel.slug,
            synopsis: post.novel.synopsis,
            coverUrl: post.novel.coverUrl,
            status: post.novel.status,
            chaptersCount: post.novel.chaptersCount,
            author: {
              id: post.novel.author.id,
              username: post.novel.author.username,
              displayName: post.novel.author.profile?.displayName ?? null,
              avatarUrl: post.novel.author.profile?.avatarUrl ?? null,
            },
          }
        : null,
      chapter: post.chapter
        ? {
            id: post.chapter.id,
            title: post.chapter.title,
            slug: post.chapter.slug,
            order: post.chapter.order,
            wordCount: post.chapter.wordCount,
            publishedAt: post.chapter.publishedAt,
            novelTitle: post.chapter.novel.title,
            novelSlug: post.chapter.novel.slug,
          }
        : null,
      world: post.world
        ? {
            id: post.world.id,
            name: post.world.name,
            slug: post.world.slug,
            tagline: post.world.tagline,
            coverUrl: post.world.coverUrl,
            genre: post.world.genre,
          }
        : null,
      characters: post.characterIds
        .map((id) => characterMap?.get(id))
        .filter(Boolean) as CharacterLinked[],
    };
  }

  private async fetchCharacterMap(
    posts: PostWithIncludes[],
  ): Promise<Map<string, CharacterLinked>> {
    const allIds = posts.flatMap((p) => p.characterIds);
    if (!allIds.length) return new Map();

    const chars = await this.prisma.character.findMany({
      where: { id: { in: allIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        avatarUrl: true,
        role: true,
        author: { select: { username: true } },
      },
    });

    return new Map(
      chars.map((c) => [
        c.id,
        {
          id: c.id,
          name: c.name,
          slug: c.slug,
          avatarUrl: c.avatarUrl,
          role: c.role,
          authorUsername: c.author.username,
        },
      ]),
    );
  }

  private async validateContentLinking(userId: string, dto: CreatePostDto) {
    if (dto.type === PostType.RECOMMENDATION) {
      if (!dto.novel_id) {
        throw new BadRequestException(
          'novel_id requerido para recomendaciones',
        );
      }
      const novel = await this.prisma.novel.findUnique({
        where: { id: dto.novel_id },
      });
      if (!novel) {
        throw new NotFoundException('Novela no encontrada');
      }
      return;
    }

    if (dto.novel_id) {
      const novel = await this.prisma.novel.findUnique({
        where: { id: dto.novel_id },
      });
      if (!novel || novel.authorId !== userId) {
        throw new ForbiddenException('No puedes vincular esta novela');
      }
    }

    if (dto.chapter_id) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: dto.chapter_id },
      });
      if (!chapter || chapter.authorId !== userId) {
        throw new ForbiddenException('No puedes vincular este capitulo');
      }
      if (dto.novel_id && chapter.novelId !== dto.novel_id) {
        throw new BadRequestException('El capitulo no pertenece a la novela');
      }
    }

    if (dto.world_id) {
      const world = await this.prisma.world.findUnique({
        where: { id: dto.world_id },
      });
      if (!world || world.authorId !== userId) {
        throw new ForbiddenException('No puedes vincular este mundo');
      }
    }

    if (dto.character_ids?.length) {
      const chars = await this.prisma.character.findMany({
        where: { id: { in: dto.character_ids }, authorId: userId },
      });
      if (chars.length !== dto.character_ids.length) {
        throw new ForbiddenException(
          'No puedes vincular todos estos personajes',
        );
      }
    }
  }
}

type PostWithIncludes = Prisma.PostGetPayload<{
  include: {
    author: {
      include: {
        profile: true;
        privacySettings: { select: { allowPostComments: true } };
      };
    };
    reactions: true;
    comments: { select: { id: true } };
    savedBy: { select: { id: true } };
    _count: { select: { comments: true; reactions: true } };
    novel: {
      select: {
        id: true;
        title: true;
        slug: true;
        synopsis: true;
        coverUrl: true;
        status: true;
        chaptersCount: true;
        author: {
          select: {
            id: true;
            username: true;
            profile: { select: { displayName: true; avatarUrl: true } };
          };
        };
      };
    };
    chapter: {
      select: {
        id: true;
        title: true;
        slug: true;
        order: true;
        wordCount: true;
        publishedAt: true;
        novel: { select: { id: true; title: true; slug: true } };
      };
    };
    world: {
      select: {
        id: true;
        name: true;
        slug: true;
        tagline: true;
        coverUrl: true;
        genre: true;
      };
    };
  };
}>;

type CharacterLinked = {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  role: string;
  authorUsername: string;
};
