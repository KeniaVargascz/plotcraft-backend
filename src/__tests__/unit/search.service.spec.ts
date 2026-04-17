import { buildSearchQuery } from '../../modules/search/utils/search-query-builder.util';

describe('SearchService - QueryBuilder', () => {
  it('sanitizes tsquery special characters from input', () => {
    const result = buildSearchQuery('magia & oscura');
    expect(result.normalized).toBe('magia oscura');
    expect(result.tsquery).toBe('magia & oscura');
  });

  it('builds an AND query for multi-word input', () => {
    const result = buildSearchQuery('magia oscura');
    expect(result.tsquery).toBe('magia & oscura');
  });

  it('falls back to ILIKE for single character input', () => {
    const result = buildSearchQuery('a');
    expect(result.useFullText).toBe(false);
    expect(result.tsquery).toBeNull();
    expect(result.ilike).toBe('%a%');
  });

  it('sanitizes SQL-ish payloads', () => {
    const result = buildSearchQuery("'; DROP TABLE novels; --");
    expect(result.normalized).not.toContain("'");
    expect(result.normalized).toContain('DROP TABLE novels');
  });

  it('handles empty string gracefully', () => {
    const result = buildSearchQuery('   ');
    expect(result.normalized).toBe('');
    expect(result.terms).toEqual([]);
    expect(result.tsquery).toBeNull();
  });
});
