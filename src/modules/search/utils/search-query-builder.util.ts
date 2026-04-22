export type SearchQueryParts = {
  normalized: string;
  tsquery: string;
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
  // Full-text search disabled: PgBouncer transaction mode (Neon pooler)
  // has issues with prepared statements in raw queries.
  // The tsvector columns and GIN indexes exist; re-enable when using a
  // direct DB connection or after verifying $queryRaw works with PgBouncer.
  const useFullText = false;
  const tsquery = terms.length > 0 ? terms.join(' & ') : '';

  return {
    normalized,
    tsquery,
    ilike: `%${normalized}%`,
    terms,
    useFullText,
  };
}
