-- Materialized view: trending novels (scored by recent likes, bookmarks, views, chapters)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trending_novels AS
SELECT
  n.id,
  (
    COALESCE((SELECT COUNT(*) FROM novel_likes nl WHERE nl.novel_id = n.id AND nl.created_at > NOW() - INTERVAL '72 hours'), 0) * 3 +
    COALESCE((SELECT COUNT(*) FROM novel_bookmarks nb WHERE nb.novel_id = n.id AND nb.created_at > NOW() - INTERVAL '72 hours'), 0) * 2 +
    n.views_count +
    COALESCE((SELECT COUNT(*) FROM chapters c WHERE c.novel_id = n.id AND c.status = 'PUBLISHED' AND c.published_at > NOW() - INTERVAL '72 hours'), 0) * 5
  ) AS trending_score
FROM novels n
WHERE n.is_public = true AND n.status != 'DRAFT'
ORDER BY trending_score DESC
LIMIT 50;

CREATE UNIQUE INDEX IF NOT EXISTS mv_trending_novels_id ON mv_trending_novels(id);

-- Materialized view: trending authors
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trending_authors AS
SELECT
  u.id,
  (
    COALESCE((SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id AND f.created_at > NOW() - INTERVAL '7 days'), 0) * 2 +
    COALESCE((SELECT COUNT(*) FROM chapters c JOIN novels n ON c.novel_id = n.id WHERE n.author_id = u.id AND c.status = 'PUBLISHED' AND c.published_at > NOW() - INTERVAL '7 days'), 0) * 3 +
    COALESCE((SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.created_at > NOW() - INTERVAL '7 days'), 0)
  ) AS trending_score
FROM users u
WHERE u.is_active = true
ORDER BY trending_score DESC
LIMIT 50;

CREATE UNIQUE INDEX IF NOT EXISTS mv_trending_authors_id ON mv_trending_authors(id);

-- Materialized view: platform stats (cached counts)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_stats AS
SELECT
  (SELECT COUNT(*) FROM novels WHERE is_public = true AND status != 'DRAFT') AS novels_count,
  (SELECT COUNT(*) FROM users WHERE is_active = true) AS authors_count,
  (SELECT COUNT(*) FROM worlds WHERE visibility = 'PUBLIC') AS worlds_count,
  (SELECT COUNT(*) FROM characters WHERE is_public = true) AS characters_count,
  (SELECT COUNT(*) FROM chapters WHERE status = 'PUBLISHED') AS chapters_count;
