import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChapterStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatNovelTxt } from './formatters/novel-txt.formatter';
import { formatNovelMd } from './formatters/novel-md.formatter';
import { formatNovelJson } from './formatters/novel-json.formatter';
import { formatWorldJson } from './formatters/world-json.formatter';
import { formatCharacterJson } from './formatters/character-json.formatter';

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportNovelTxt(slug: string, userId: string): Promise<string> {
    const { novel, chapters, authorName, genres } =
      await this.loadNovelWithChapters(slug, userId);

    return formatNovelTxt(novel, chapters, authorName, genres);
  }

  async exportNovelMd(slug: string, userId: string): Promise<string> {
    const { novel, chapters, authorName, genres } =
      await this.loadNovelWithChapters(slug, userId);

    return formatNovelMd(novel, chapters, authorName, genres);
  }

  async exportNovelJson(slug: string, userId: string): Promise<string> {
    const { novel, chapters, authorName, genres } =
      await this.loadNovelWithChapters(slug, userId);

    return formatNovelJson(novel, chapters, authorName, genres);
  }

  async exportChapterMd(
    novelSlug: string,
    chapterSlug: string,
    userId: string,
  ): Promise<string> {
    const novel = await this.prisma.novel.findUnique({
      where: { slug: novelSlug },
      select: { id: true, authorId: true, title: true },
    });

    if (!novel) {
      throw new NotFoundException('Novela no encontrada');
    }

    if (novel.authorId !== userId) {
      throw new ForbiddenException('No tienes permiso para exportar esta novela');
    }

    const chapter = await this.prisma.chapter.findUnique({
      where: {
        novelId_slug: { novelId: novel.id, slug: chapterSlug },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Capítulo no encontrado');
    }

    const lines: string[] = [
      '---',
      `title: "${chapter.title}"`,
      `novel: "${novel.title}"`,
      `order: ${chapter.order}`,
      `wordCount: ${chapter.wordCount}`,
      `status: "${chapter.status}"`,
      chapter.publishedAt
        ? `publishedAt: "${chapter.publishedAt.toISOString().split('T')[0]}"`
        : '',
      `exported: "${new Date().toISOString().split('T')[0]}"`,
      '---',
      '',
      `# ${chapter.title}`,
      '',
      chapter.content,
    ].filter((line) => line !== '');

    return lines.join('\n');
  }

  async exportWorldJson(slug: string, userId: string): Promise<string> {
    const world = await this.prisma.world.findUnique({
      where: { slug },
      include: {
        locations: true,
        characters: {
          select: {
            id: true,
            name: true,
            slug: true,
            role: true,
            status: true,
            age: true,
            appearance: true,
            personality: true,
            backstory: true,
          },
        },
        wbCategories: {
          include: {
            entries: {
              select: {
                id: true,
                name: true,
                slug: true,
                fields: true,
              },
            },
          },
        },
      },
    });

    if (!world) {
      throw new NotFoundException('Mundo no encontrado');
    }

    if (world.authorId !== userId) {
      throw new ForbiddenException('No tienes permiso para exportar este mundo');
    }

    return formatWorldJson(
      world,
      world.locations,
      world.characters,
      world.wbCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        description: cat.description,
        color: cat.color,
        fieldSchema: cat.fieldSchema,
        entries: cat.entries.map((e) => ({
          id: e.id,
          title: e.name,
          slug: e.slug,
          fields: e.fields,
        })),
      })),
    );
  }

  async exportCharacterJson(
    username: string,
    charSlug: string,
    userId: string,
  ): Promise<string> {
    const author = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!author) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const character = await this.prisma.character.findUnique({
      where: {
        authorId_slug: { authorId: author.id, slug: charSlug },
      },
      include: {
        relationshipsAsSource: {
          include: {
            target: { select: { name: true, slug: true } },
          },
        },
        novelCharacters: {
          include: {
            novel: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });

    if (!character) {
      throw new NotFoundException('Personaje no encontrado');
    }

    if (character.authorId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para exportar este personaje',
      );
    }

    const relationships = character.relationshipsAsSource.map((r) => ({
      id: r.id,
      type: r.type,
      description: r.description,
      isMutual: r.isMutual,
      targetName: r.target.name,
      targetSlug: r.target.slug,
    }));

    const novels = character.novelCharacters.map((nc) => ({
      id: nc.novel.id,
      title: nc.novel.title,
      slug: nc.novel.slug,
      roleInNovel: nc.roleInNovel,
    }));

    return formatCharacterJson(character, relationships, novels);
  }

  private async loadNovelWithChapters(slug: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug },
      include: {
        author: {
          include: {
            profile: { select: { displayName: true } },
          },
        },
        genres: {
          include: { genre: true },
        },
        chapters: {
          where: { status: ChapterStatus.PUBLISHED },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!novel) {
      throw new NotFoundException('Novela no encontrada');
    }

    if (novel.authorId !== userId) {
      throw new ForbiddenException('No tienes permiso para exportar esta novela');
    }

    const authorName =
      novel.author.profile?.displayName ?? novel.author.username;
    const genres = novel.genres.map((ng) => ng.genre.label);

    return { novel, chapters: novel.chapters, authorName, genres };
  }
}
