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
  // Full-text search disabled: the search_vector tsvector columns were removed
  // in migration 20260406013347. All search uses ILIKE fallback path.
  const useFullText = false;

  return {
    normalized,
    tsquery: null,
    ilike: `%${normalized}%`,
    terms,
    useFullText,
  };
}
