/**
 * Convierte el contenido de un capitulo (HTML del editor Quill o Markdown
 * legacy) a texto plano para conteo y validaciones.
 */
export function stripMarkdown(value: string) {
  if (!value) {
    return '';
  }

  // 1) Quita tags HTML (capitulos nuevos vienen de Quill como HTML).
  //    Reemplaza por espacio para no pegar palabras adyacentes.
  const noHtml = value
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z0-9#]+;/gi, '');

  // 2) Quita sintaxis Markdown residual (capitulos legacy o mezcla).
  return noHtml
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+]\([^)]+\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#-]/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(value: string) {
  const plain = stripMarkdown(value);
  if (!plain) {
    return 0;
  }

  return plain.split(/\s+/).filter(Boolean).length;
}
