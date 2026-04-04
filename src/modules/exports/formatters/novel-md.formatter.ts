type NovelData = {
  title: string;
  slug: string;
  synopsis: string | null;
  status: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type ChapterData = {
  order: number;
  title: string;
  publishedAt: Date | null;
  wordCount: number;
  content: string;
};

export function formatNovelMd(
  novel: NovelData,
  chapters: ChapterData[],
  author: string,
  genres: string[],
): string {
  const exportDate = new Date().toISOString().split('T')[0];

  const frontmatter = [
    '---',
    `title: "${novel.title}"`,
    `author: "${author}"`,
    `slug: "${novel.slug}"`,
    `status: "${novel.status}"`,
    `wordCount: ${novel.wordCount}`,
    `genres: [${genres.map((g) => `"${g}"`).join(', ')}]`,
    `created: "${novel.createdAt.toISOString().split('T')[0]}"`,
    `updated: "${novel.updatedAt.toISOString().split('T')[0]}"`,
    `exported: "${exportDate}"`,
    '---',
    '',
  ];

  const lines: string[] = [...frontmatter];

  lines.push(`# ${novel.title}`, '');

  if (novel.synopsis) {
    lines.push(`> ${novel.synopsis}`, '');
  }

  for (const chapter of chapters) {
    lines.push(`## Capítulo ${chapter.order}: ${chapter.title}`, '');
    if (chapter.publishedAt) {
      lines.push(
        `*${chapter.publishedAt.toISOString().split('T')[0]} — ${chapter.wordCount} palabras*`,
        '',
      );
    }
    lines.push(chapter.content, '');
  }

  return lines.join('\n');
}
