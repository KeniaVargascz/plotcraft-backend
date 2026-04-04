type NovelData = {
  title: string;
  synopsis: string | null;
  status: string;
  wordCount: number;
};

type ChapterData = {
  order: number;
  title: string;
  publishedAt: Date | null;
  wordCount: number;
  content: string;
};

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '');
}

export function formatNovelTxt(
  novel: NovelData,
  chapters: ChapterData[],
  author: string,
  genres: string[],
): string {
  const divider = '═══════════════════════════════';
  const exportDate = new Date().toISOString().split('T')[0];

  const lines: string[] = [
    divider,
    novel.title.toUpperCase(),
    `Por ${author}`,
    divider,
    '',
  ];

  if (novel.synopsis) {
    lines.push(novel.synopsis, '');
  }

  if (genres.length > 0) {
    lines.push(`Géneros: ${genres.join(', ')}`);
  }
  lines.push(`Estado: ${novel.status}`);
  lines.push(`Palabras totales: ${novel.wordCount}`);
  lines.push(`Exportado el: ${exportDate}`);
  lines.push('', divider, '');

  for (const chapter of chapters) {
    lines.push(`CAPÍTULO ${chapter.order}: ${chapter.title.toUpperCase()}`);
    if (chapter.publishedAt) {
      lines.push(chapter.publishedAt.toISOString().split('T')[0]);
    }
    lines.push(`${chapter.wordCount} palabras`);
    lines.push('');
    lines.push(stripMarkdown(chapter.content));
    lines.push('', '---', '');
  }

  return lines.join('\n');
}
