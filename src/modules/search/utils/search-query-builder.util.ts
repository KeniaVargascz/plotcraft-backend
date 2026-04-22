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
  // Full-text search disabled: $queryRawUnsafe with positional params ($1, $2)
  // is incompatible with PgBouncer transaction mode (Neon pooler).
  // The tsvector columns and GIN indexes exist but the raw SQL queries fail
  // at runtime. Re-enable when using a direct DB connection for search.
  const useFullText = false;

  return {
    normalized,
    tsquery: null,
    ilike: `%${normalized}%`,
    terms,
    useFullText,
  };
}
