type NovelData = {
  id: string;
  title: string;
  slug: string;
  synopsis: string | null;
  coverUrl: string | null;
  status: string;
  rating: string;
  tags: string[];
  warnings: string[];
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type ChapterData = {
  id: string;
  order: number;
  title: string;
  slug: string;
  content: string;
  wordCount: number;
  publishedAt: Date | null;
};

export function formatNovelJson(
  novel: NovelData,
  chapters: ChapterData[],
  author: string,
  genres: string[],
): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    novel: {
      id: novel.id,
      title: novel.title,
      slug: novel.slug,
      synopsis: novel.synopsis,
      coverUrl: novel.coverUrl,
      status: novel.status,
      rating: novel.rating,
      tags: novel.tags,
      warnings: novel.warnings,
      wordCount: novel.wordCount,
      genres,
      author,
      createdAt: novel.createdAt.toISOString(),
      updatedAt: novel.updatedAt.toISOString(),
    },
    chapters: chapters.map((ch) => ({
      id: ch.id,
      order: ch.order,
      title: ch.title,
      slug: ch.slug,
      content: ch.content,
      wordCount: ch.wordCount,
      publishedAt: ch.publishedAt?.toISOString() ?? null,
    })),
  };

  return JSON.stringify(payload, null, 2);
}
