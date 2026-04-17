import {
  ChapterStatus,
  NovelRating,
  NovelStatus,
  NotificationType,
  PostType,
  ReactionType,
  WorldVisibility,
} from '@prisma/client';

export const createUserFixture = (overrides: Record<string, unknown> = {}) => ({
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test@test.com',
  username: 'testuser',
  passwordHash: '$2b$12$hash',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  profile: null,
  ...overrides,
});

export const createProfileFixture = (
  overrides: Record<string, unknown> = {},
) => ({
  id: '00000000-0000-0000-0000-000000000010',
  userId: '00000000-0000-0000-0000-000000000001',
  displayName: 'Test User',
  bio: 'Fixture bio',
  avatarUrl: null,
  bannerUrl: null,
  website: null,
  isPublic: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

export const createNovelFixture = (
  overrides: Record<string, unknown> = {},
) => ({
  id: '00000000-0000-0000-0001-000000000001',
  authorId: '00000000-0000-0000-0000-000000000001',
  title: 'Fixture Novel',
  slug: 'fixture-novel',
  synopsis: 'Fixture synopsis',
  coverUrl: null,
  status: NovelStatus.DRAFT,
  rating: NovelRating.G,
  tags: ['fantasia'],
  warnings: [],
  isPublic: false,
  wordCount: 0,
  viewsCount: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  author: {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'testuser',
    profile: createProfileFixture(),
  },
  genres: [],
  likes: [],
  bookmarks: [],
  novelWorlds: [],
  novelCharacters: [],
  readingProgress: [],
  _count: {
    chapters: 0,
    likes: 0,
    bookmarks: 0,
  },
  ...overrides,
});

export const createChapterFixture = (
  overrides: Record<string, unknown> = {},
) => ({
  id: '00000000-0000-0000-0002-000000000001',
  novelId: '00000000-0000-0000-0001-000000000001',
  authorId: '00000000-0000-0000-0000-000000000001',
  title: 'Fixture Chapter',
  slug: 'fixture-chapter',
  content: 'Texto de prueba para un capitulo con suficiente contenido.',
  order: 1,
  status: ChapterStatus.DRAFT,
  wordCount: 10,
  scheduledAt: null,
  publishedAt: null,
  contentSnapshot: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  novel: createNovelFixture(),
  ...overrides,
});

export const createPostFixture = (overrides: Record<string, unknown> = {}) => ({
  id: '00000000-0000-0000-0005-000000000001',
  authorId: '00000000-0000-0000-0000-000000000001',
  type: PostType.TEXT,
  content: 'Fixture post',
  isSaved: false,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  author: {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'testuser',
    profile: createProfileFixture(),
  },
  reactions: [],
  comments: [],
  savedBy: [],
  characterIds: [],
  novel: null,
  chapter: null,
  world: null,
  _count: {
    comments: 0,
    reactions: 0,
  },
  ...overrides,
});

export const createNotificationFixture = (
  overrides: Record<string, unknown> = {},
) => ({
  id: '00000000-0000-0000-0006-000000000001',
  userId: '00000000-0000-0000-0000-000000000001',
  type: NotificationType.NEW_FOLLOWER,
  title: 'Nuevo seguidor',
  body: 'Tienes un nuevo seguidor',
  url: '/perfil/testuser',
  actorId: '00000000-0000-0000-0000-000000000002',
  isRead: false,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

export const createWorldFixture = (
  overrides: Record<string, unknown> = {},
) => ({
  id: '00000000-0000-0000-0003-000000000001',
  authorId: '00000000-0000-0000-0000-000000000001',
  name: 'Fixture World',
  slug: 'fixture-world',
  tagline: 'Fixture world tagline',
  description: 'Fixture world description',
  setting: null,
  magicSystem: null,
  rules: null,
  coverUrl: null,
  mapUrl: null,
  visibility: WorldVisibility.PUBLIC,
  tags: ['fantasia'],
  metadata: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  author: {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'testuser',
    profile: createProfileFixture(),
  },
  _count: {
    locations: 0,
    characters: 0,
    novelWorlds: 0,
  },
  ...overrides,
});

export const reactionSummaryFixture = (
  overrides: Partial<Record<ReactionType, number>> = {},
) => ({
  [ReactionType.LIKE]: 0,
  [ReactionType.LOVE]: 0,
  [ReactionType.FIRE]: 0,
  [ReactionType.CLAP]: 0,
  ...overrides,
});
