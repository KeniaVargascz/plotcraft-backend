// Feature flag key constants — single source of truth for the backend.
// Frontend mirror: plotcraft-frontend/src/app/core/constants/feature-flags.constants.ts

export const FeatureFlag = {
  // Social
  SOCIAL_FEED: 'social.feed',
  SOCIAL_FEED_COMPOSER: 'social.feed.composer',
  SOCIAL_FEED_REACTIONS: 'social.feed.reactions',
  SOCIAL_FEED_COMMENTS: 'social.feed.comments',
  SOCIAL_FOLLOWS: 'social.follows',
  SOCIAL_NOTIFICATIONS: 'social.notifications',

  // Explore
  EXPLORE_DISCOVERY: 'explore.discovery',
  EXPLORE_SEARCH: 'explore.search',
  EXPLORE_NOVELS_CATALOG: 'explore.novels_catalog',
  EXPLORE_WORLDS_CATALOG: 'explore.worlds_catalog',
  EXPLORE_CHARACTERS_CATALOG: 'explore.characters_catalog',
  EXPLORE_SERIES_CATALOG: 'explore.series_catalog',

  // Author
  AUTHOR_NOVELS: 'author.novels',
  AUTHOR_NOVELS_CHAPTERS: 'author.novels.chapters',
  AUTHOR_NOVELS_SCHEDULING: 'author.novels.scheduling',
  AUTHOR_WORLDS: 'author.worlds',
  AUTHOR_WORLDS_WORLDBUILDING: 'author.worlds.worldbuilding',
  AUTHOR_WORLDS_MAPS: 'author.worlds.maps',
  AUTHOR_CHARACTERS: 'author.characters',
  AUTHOR_CHARACTERS_RELATIONSHIPS: 'author.characters.relationships',
  AUTHOR_SERIES: 'author.series',
  AUTHOR_VISUAL_BOARDS: 'author.visual_boards',
  AUTHOR_TIMELINES: 'author.timelines',
  AUTHOR_PLANNER: 'author.planner',
  AUTHOR_PLANNER_CALENDAR: 'author.planner.calendar',
  AUTHOR_ANALYTICS: 'author.analytics',

  // Reader
  READER_LIBRARY: 'reader.library',
  READER_LIBRARY_BOOKMARKS: 'reader.library.bookmarks',
  READER_LIBRARY_HIGHLIGHTS: 'reader.library.highlights',
  READER_LIBRARY_LISTS: 'reader.library.lists',
  READER_LIBRARY_GOALS: 'reader.library.goals',
  READER_LIBRARY_STATS: 'reader.library.stats',
  READER_SUBSCRIPTIONS: 'reader.subscriptions',
  READER_KUDOS: 'reader.kudos',
  READER_VOTES: 'reader.votes',

  // Community
  COMMUNITY_COMMUNITIES: 'community.communities',
  COMMUNITY_COMMUNITIES_FORUMS: 'community.communities.forums',
  COMMUNITY_FORUM: 'community.forum',
  COMMUNITY_FORUM_POLLS: 'community.forum.polls',
  COMMUNITY_FORUM_REACTIONS: 'community.forum.reactions',

  // Platform
  PLATFORM_REGISTRATION: 'platform.registration',
  PLATFORM_MEDIA_UPLOAD: 'platform.media_upload',
  PLATFORM_CONTENT_WARNINGS: 'platform.content_warnings',
  PLATFORM_TEMPLATES: 'platform.templates',
  PLATFORM_DATA_EXPORT: 'platform.data_export',
} as const;

export type FeatureFlagKey = (typeof FeatureFlag)[keyof typeof FeatureFlag];
