export type SearchQueryParts = {
  normalized: string;
  tsquery: string | null;
  ilike: string;
  terms: string[];
  useFullText: boolean;
};

const TSQUERY_SPECIAL_CHARS = /[&|!:()'"]/g;

export function buildSearchQuery(input: string): SearchQueryParts {
  const normalized = input
    .trim()
    .replace(TSQUERY_SPECIAL_CHARS, ' ')
    .replace(/\s+/g, ' ');
  const terms = normalized
    .split(' ')
    .map((term) => term.trim())
    .filter(Boolean);
  const useFullText =
    normalized.length >= 3 && terms.every((term) => term.length >= 3);

  return {
    normalized,
    tsquery: useFullText ? terms.join(' & ') : null,
    ilike: `%${normalized}%`,
    terms,
    useFullText,
  };
}
