import {
  CharacterRole,
  CharacterStatus,
  ChapterStatus,
  HighlightColor,
  NovelRating,
  NovelStatus,
  PostType,
  Prisma,
  PrismaClient,
  ReactionType,
  ReaderFontFamily,
  ReaderMode,
  ReadingListVisibility,
  WorldVisibility,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import slugify from 'slugify';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo1234!';

const usersSeed = [
  {
    email: 'demo@plotcraft.com',
    username: 'demo_writer',
    profile: {
      displayName: 'Demo Writer',
      bio: 'Cuenta principal de demostracion para probar el flujo de PlotCraft con fantasia, magia, oscuridad y cronicas del velo.',
      website: 'https://plotcraft.local/demo-writer',
      avatarUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=demo_writer',
    },
  },
  {
    email: 'luna@plotcraft.com',
    username: 'luna_ink',
    profile: {
      displayName: 'Luna Ink',
      bio: 'Fantasia urbana, diarios de personaje y mapas emocionales.',
      website: 'https://plotcraft.local/luna-ink',
    },
  },
  {
    email: 'mateo@plotcraft.com',
    username: 'mateo.worlds',
    profile: {
      displayName: 'Mateo Worlds',
      bio: 'Construccion de mundos, cronologias y sistemas politicos.',
      website: 'https://plotcraft.local/mateo-worlds',
    },
  },
  {
    email: 'sofia@plotcraft.com',
    username: 'sofia_canvas',
    profile: {
      displayName: 'Sofia Canvas',
      bio: 'Showcases visuales, moodboards y anuncios de seriales.',
      website: 'https://plotcraft.local/sofia-canvas',
    },
  },
  {
    email: 'writer.luna@plotcraft.com',
    username: 'writer_luna',
    profile: {
      displayName: 'Writer Luna',
      bio: 'Misterio, thriller y silencios que pesan mas que un crimen.',
      website: 'https://plotcraft.local/writer-luna',
      avatarUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=writer_luna',
    },
  },
  {
    email: 'reader.alex@plotcraft.com',
    username: 'reader_alex',
    profile: {
      displayName: 'Reader Alex',
      bio: 'Lector beta, comentarista y coleccionista de historias largas con fantasia, personajes complejos y mundos memorables.',
      website: 'https://plotcraft.local/reader-alex',
    },
  },
  {
    email: 'writer.marcos@plotcraft.com',
    username: 'writer_marcos',
    profile: {
      displayName: 'Writer Marcos',
      bio: 'Autor invitado que prueba herramientas de publicacion y seriales.',
      website: 'https://plotcraft.local/writer-marcos',
    },
  },
] as const;

const genreSeed = [
  ['fantasia', 'Fantasía'],
  ['ciencia-ficcion', 'Ciencia ficción'],
  ['romance', 'Romance'],
  ['misterio', 'Misterio'],
  ['terror', 'Terror'],
  ['thriller', 'Thriller'],
  ['aventura', 'Aventura'],
  ['historica', 'Histórica'],
  ['fanfiction', 'Fanfiction'],
  ['drama', 'Drama'],
  ['accion', 'Acción'],
  ['distopia', 'Distopía'],
  ['paranormal', 'Paranormal'],
  ['suspenso', 'Suspenso'],
  ['comedia', 'Comedia'],
  ['isekai', 'Isekai'],
] as const;

function normalizeSlug(value: string) {
  return slugify(value, { lower: true, strict: true, trim: true });
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/[#>*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(value: string) {
  const cleaned = stripMarkdown(value);
  return cleaned ? cleaned.split(' ').length : 0;
}

function buildMarkdownChapter(seedTitle: string, perspective: string) {
  return `# ${seedTitle}

${perspective} se abre paso entre corredores de piedra humeda mientras enumera, una por una, las promesas que hizo antes de cruzar el Velo. Cada paso despierta un eco distinto: un recuerdo de infancia, una advertencia mal escuchada, el peso exacto de las decisiones que todavia no se han tomado. La escena no avanza por sobresaltos faciles, sino por una tension sostenida que obliga a mirar cada detalle, desde la forma en que la luz se rompe sobre las grietas hasta el modo en que la respiracion cambia cuando alguien pronuncia un nombre prohibido.

En el centro del pasaje hay un arco cubierto de simbolos borrados. El personaje principal no intenta comprenderlos de inmediato; primero toca la piedra, siente el polvo en los dedos y recuerda la historia que le contaban sobre viajeros que volvian cambiados despues de mirar demasiado tiempo al otro lado. Esa memoria funciona como un ancla emocional y convierte el lugar en algo mas que escenografia. Tambien deja claro que el conflicto verdadero no es solo externo. La amenaza esta dentro de la narradora, en su impulso constante por huir justo cuando por fin entiende que quedarse puede ser un acto de valentia.

Cuando el umbral se abre, no aparece un monstruo ni una batalla repentina. Aparece una ciudad suspendida sobre agua negra, tejados de cobre gastado y campanas que suenan como si alguien respirara dentro de ellas. La descripcion se apoya en detalles concretos para sostener el asombro: el olor a sal mineral, la textura del viento, las voces que llegan amortiguadas desde puentes lejanos. Esa acumulacion de matices sirve para que el lector entre en la historia sin perder de vista la fragilidad del punto de vista.

Al final del fragmento, ${perspective.toLowerCase()} descubre una inscripcion incompleta y entiende que el mapa que llevaba escondido estaba equivocado desde el principio. No se trata de un giro por sorpresa, sino de una correccion de rumbo. La historia gana impulso porque ahora existe una pregunta nueva, mas precisa y mas peligrosa: si el camino dibujado era falso, quien queria que llegara exactamente hasta este lugar.`;
}

async function upsertUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const entry of usersSeed) {
    await prisma.user.upsert({
      where: { email: entry.email },
      update: {
        username: entry.username,
        passwordHash,
        isActive: true,
      },
      create: {
        email: entry.email,
        username: entry.username,
        passwordHash,
        isActive: true,
      },
    });
  }

  for (const entry of usersSeed) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: entry.email },
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        displayName: entry.profile.displayName,
        bio: entry.profile.bio,
        website: entry.profile.website,
        avatarUrl:
          'avatarUrl' in entry.profile ? entry.profile.avatarUrl : undefined,
        isPublic: true,
      },
      create: {
        userId: user.id,
        displayName: entry.profile.displayName,
        bio: entry.profile.bio,
        website: entry.profile.website,
        avatarUrl:
          'avatarUrl' in entry.profile ? entry.profile.avatarUrl : undefined,
        isPublic: true,
      },
    });
  }
}

async function seedSocialGraph() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: usersSeed.map((entry) => entry.email),
      },
    },
  });

  const byUsername = new Map(users.map((user) => [user.username, user]));

  const follows = [
    ['demo_writer', 'luna_ink'],
    ['demo_writer', 'mateo.worlds'],
    ['luna_ink', 'demo_writer'],
    ['luna_ink', 'sofia_canvas'],
    ['mateo.worlds', 'demo_writer'],
    ['mateo.worlds', 'sofia_canvas'],
    ['sofia_canvas', 'demo_writer'],
    ['reader_alex', 'demo_writer'],
    ['reader_alex', 'writer_luna'],
    ['writer_marcos', 'demo_writer'],
  ] as const;

  for (const [followerUsername, followingUsername] of follows) {
    const follower = byUsername.get(followerUsername);
    const following = byUsername.get(followingUsername);

    if (!follower || !following) {
      continue;
    }

    await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: follower.id,
          followingId: following.id,
        },
      },
      update: {},
      create: {
        followerId: follower.id,
        followingId: following.id,
      },
    });
  }
}

async function seedPostsAndInteractions() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: usersSeed.map((entry) => entry.email),
      },
    },
  });

  const byUsername = new Map(users.map((user) => [user.username, user]));

  const postsSeed = [
    {
      authorUsername: 'demo_writer',
      type: PostType.UPDATE,
      content:
        'Acabo de reordenar la cronologia de mi saga y por fin encontre el punto exacto donde la protagonista deja de huir.',
    },
    {
      authorUsername: 'luna_ink',
      type: PostType.TEXT,
      content:
        'Estoy probando voces narrativas para una detective que recuerda canciones en lugar de fechas.',
    },
    {
      authorUsername: 'mateo.worlds',
      type: PostType.WORLDBUILDING,
      content:
        'Mapa mental del reino costero: tres puertos, una religion estatal y una guerra comercial que dura veinte anos.',
    },
    {
      authorUsername: 'sofia_canvas',
      type: PostType.SHOWCASE,
      content:
        'Moodboard listo para el relanzamiento de Eclipse de Sal. Colores oxidados, vidrio, metal y lluvia constante.',
    },
    {
      authorUsername: 'demo_writer',
      type: PostType.ANNOUNCEMENT,
      content:
        'El primer arco de Ceniza y Marea queda abierto para lectura beta esta semana.',
    },
    {
      authorUsername: 'reader_alex',
      type: PostType.TEXT,
      content:
        'Estoy tomando notas sobre escritura, personajes y el modo en que un mundo bien construido sostiene cada escena.',
    },
    {
      authorUsername: 'mateo.worlds',
      type: PostType.WORLDBUILDING,
      content:
        'Cada mundo necesita reglas visibles: magia con costo, politica en conflicto y geografia que empuje la trama.',
    },
    {
      authorUsername: 'writer_luna',
      type: PostType.UPDATE,
      content:
        'Hoy reescribi una escena completa para que el silencio, la oscuridad y la escritura interior se sintieran mas honestos.',
    },
  ] as const;

  const postsByContent = new Map<string, { id: string }>();

  for (const entry of postsSeed) {
    const author = byUsername.get(entry.authorUsername);
    if (!author) {
      continue;
    }

    const existing = await prisma.post.findFirst({
      where: {
        authorId: author.id,
        content: entry.content,
      },
    });

    const post = existing
      ? await prisma.post.update({
          where: { id: existing.id },
          data: {
            type: entry.type,
            content: entry.content,
            deletedAt: null,
          },
        })
      : await prisma.post.create({
          data: {
            authorId: author.id,
            type: entry.type,
            content: entry.content,
          },
        });

    postsByContent.set(entry.content, { id: post.id });
  }

  const commentsSeed = [
    {
      postContent:
        'Acabo de reordenar la cronologia de mi saga y por fin encontre el punto exacto donde la protagonista deja de huir.',
      authorUsername: 'luna_ink',
      content:
        'Ese punto de quiebre se siente fuerte. Comparte luego como cambia la voz del capitulo.',
    },
    {
      postContent:
        'Mapa mental del reino costero: tres puertos, una religion estatal y una guerra comercial que dura veinte anos.',
      authorUsername: 'demo_writer',
      content:
        'Necesito leer mas de esa guerra comercial. Ya tiene olor a conflicto mayor.',
    },
    {
      postContent:
        'Moodboard listo para el relanzamiento de Eclipse de Sal. Colores oxidados, vidrio, metal y lluvia constante.',
      authorUsername: 'mateo.worlds',
      content: 'La paleta encaja perfecto con una ciudad portuaria industrial.',
    },
  ] as const;

  for (const entry of commentsSeed) {
    const post = postsByContent.get(entry.postContent);
    const author = byUsername.get(entry.authorUsername);

    if (!post || !author) {
      continue;
    }

    const existing = await prisma.comment.findFirst({
      where: {
        postId: post.id,
        authorId: author.id,
        content: entry.content,
      },
    });

    if (!existing) {
      await prisma.comment.create({
        data: {
          postId: post.id,
          authorId: author.id,
          content: entry.content,
        },
      });
    }
  }

  const reactionsSeed = [
    {
      postContent:
        'Acabo de reordenar la cronologia de mi saga y por fin encontre el punto exacto donde la protagonista deja de huir.',
      username: 'mateo.worlds',
      reactionType: ReactionType.LOVE,
    },
    {
      postContent:
        'Estoy probando voces narrativas para una detective que recuerda canciones en lugar de fechas.',
      username: 'demo_writer',
      reactionType: ReactionType.FIRE,
    },
    {
      postContent:
        'Mapa mental del reino costero: tres puertos, una religion estatal y una guerra comercial que dura veinte anos.',
      username: 'sofia_canvas',
      reactionType: ReactionType.CLAP,
    },
    {
      postContent:
        'Moodboard listo para el relanzamiento de Eclipse de Sal. Colores oxidados, vidrio, metal y lluvia constante.',
      username: 'luna_ink',
      reactionType: ReactionType.LIKE,
    },
  ] as const;

  for (const entry of reactionsSeed) {
    const post = postsByContent.get(entry.postContent);
    const user = byUsername.get(entry.username);

    if (!post || !user) {
      continue;
    }

    await prisma.reaction.upsert({
      where: {
        postId_userId: {
          postId: post.id,
          userId: user.id,
        },
      },
      update: {
        reactionType: entry.reactionType,
      },
      create: {
        postId: post.id,
        userId: user.id,
        reactionType: entry.reactionType,
      },
    });
  }

  const savedPairs = [
    {
      postContent:
        'Moodboard listo para el relanzamiento de Eclipse de Sal. Colores oxidados, vidrio, metal y lluvia constante.',
      username: 'demo_writer',
    },
    {
      postContent:
        'Mapa mental del reino costero: tres puertos, una religion estatal y una guerra comercial que dura veinte anos.',
      username: 'luna_ink',
    },
  ] as const;

  for (const entry of savedPairs) {
    const post = postsByContent.get(entry.postContent);
    const user = byUsername.get(entry.username);

    if (!post || !user) {
      continue;
    }

    await prisma.savedPost.upsert({
      where: {
        postId_userId: {
          postId: post.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        postId: post.id,
        userId: user.id,
      },
    });
  }
}

async function seedGenres() {
  for (const [slug, label] of genreSeed) {
    await prisma.genre.upsert({
      where: { slug },
      update: { label },
      create: { slug, label },
    });
  }
}

async function upsertNovelWithChapters(input: {
  authorUsername: string;
  title: string;
  synopsis: string;
  status: NovelStatus;
  rating: NovelRating;
  warnings?: string[];
  tags?: string[];
  genreSlugs: string[];
  isPublic: boolean;
  viewsCount: number;
  chapters: Array<{
    title: string;
    content: string;
    order: number;
    status: ChapterStatus;
  }>;
}) {
  const author = await prisma.user.findUniqueOrThrow({
    where: { username: input.authorUsername },
  });
  const slug = normalizeSlug(input.title);

  const language = await prisma.catalogLanguage.findUnique({
    where: { code: 'es' },
  });
  if (!language)
    throw new Error('CatalogLanguage "es" not found – run language seed first');

  const novel = await prisma.novel.upsert({
    where: { slug },
    update: {
      authorId: author.id,
      title: input.title,
      synopsis: input.synopsis,
      status: input.status,
      rating: input.rating,
      warnings: input.warnings ?? [],
      tags: input.tags ?? [],
      isPublic: input.isPublic,
      viewsCount: input.viewsCount,
    },
    create: {
      authorId: author.id,
      title: input.title,
      slug,
      synopsis: input.synopsis,
      status: input.status,
      rating: input.rating,
      warnings: input.warnings ?? [],
      tags: input.tags ?? [],
      isPublic: input.isPublic,
      viewsCount: input.viewsCount,
      languageId: language.id,
    },
  });

  const genres = await prisma.genre.findMany({
    where: {
      slug: {
        in: input.genreSlugs,
      },
    },
  });

  await prisma.novelGenre.deleteMany({
    where: { novelId: novel.id },
  });

  for (const genre of genres) {
    await prisma.novelGenre.upsert({
      where: {
        novelId_genreId: {
          novelId: novel.id,
          genreId: genre.id,
        },
      },
      update: {},
      create: {
        novelId: novel.id,
        genreId: genre.id,
      },
    });
  }

  for (const entry of input.chapters) {
    const chapterSlug = normalizeSlug(entry.title);
    const wordCount = countWords(entry.content);
    const publishedAt =
      entry.status === ChapterStatus.PUBLISHED
        ? new Date(Date.now() - entry.order * 86400000)
        : null;
    const contentSnapshot =
      entry.status === ChapterStatus.PUBLISHED
        ? {
            version: 1,
            content: entry.content,
            wordCount,
            publishedAt: publishedAt?.toISOString(),
          }
        : Prisma.JsonNull;

    const existingChapter = await prisma.chapter.findFirst({
      where: {
        novelId: novel.id,
        OR: [{ slug: chapterSlug }, { order: entry.order }],
      },
    });

    if (existingChapter) {
      await prisma.chapter.update({
        where: { id: existingChapter.id },
        data: {
          authorId: author.id,
          title: entry.title,
          slug: chapterSlug,
          content: entry.content,
          order: entry.order,
          status: entry.status,
          wordCount,
          publishedAt,
          scheduledAt: null,
          contentSnapshot,
        },
      });
    } else {
      await prisma.chapter.create({
        data: {
          novelId: novel.id,
          authorId: author.id,
          title: entry.title,
          slug: chapterSlug,
          content: entry.content,
          order: entry.order,
          status: entry.status,
          wordCount,
          publishedAt,
          contentSnapshot,
        },
      });
    }
  }

  const aggregate = await prisma.chapter.aggregate({
    where: {
      novelId: novel.id,
      status: ChapterStatus.PUBLISHED,
    },
    _sum: {
      wordCount: true,
    },
  });

  await prisma.novel.update({
    where: { id: novel.id },
    data: {
      wordCount: aggregate._sum.wordCount ?? 0,
    },
  });

  return novel;
}

async function seedNovels() {
  const veilChapters = [
    {
      title: 'Capitulo 1: El borde del agua',
      content: buildMarkdownChapter('El borde del agua', 'La cronista'),
      order: 1,
      status: ChapterStatus.PUBLISHED,
    },
    {
      title: 'Capitulo 2: Campanas bajo la niebla',
      content: buildMarkdownChapter('Campanas bajo la niebla', 'La heredera'),
      order: 2,
      status: ChapterStatus.PUBLISHED,
    },
    {
      title: 'Capitulo 3: El archivo sumergido',
      content: buildMarkdownChapter('El archivo sumergido', 'La guardiana'),
      order: 3,
      status: ChapterStatus.PUBLISHED,
    },
    {
      title: 'Capitulo 4: Cartografia del fuego',
      content: buildMarkdownChapter('Cartografia del fuego', 'La narradora'),
      order: 4,
      status: ChapterStatus.DRAFT,
    },
  ];

  const silenceChapters = [
    {
      title: 'Capitulo 1: Puerta cerrada',
      content: buildMarkdownChapter('Puerta cerrada', 'La inspectora'),
      order: 1,
      status: ChapterStatus.PUBLISHED,
    },
    {
      title: 'Capitulo 2: Lo que no dijo nadie',
      content: buildMarkdownChapter('Lo que no dijo nadie', 'La testigo'),
      order: 2,
      status: ChapterStatus.PUBLISHED,
    },
  ];

  const veil = await upsertNovelWithChapters({
    authorUsername: 'demo_writer',
    title: 'Las Cronicas del Velo',
    synopsis:
      'Una cartografa descubre que el mapa de su ciudad encubre un corredor hacia un reino anfibio donde toda deuda se paga con memoria, magia del velo, silencio ritual y oscuridad marina.',
    status: NovelStatus.IN_PROGRESS,
    rating: NovelRating.T,
    genreSlugs: ['fantasia'],
    tags: ['serial', 'magia', 'ciudad-puerto'],
    isPublic: true,
    viewsCount: 42,
    chapters: veilChapters,
  });

  const silence = await upsertNovelWithChapters({
    authorUsername: 'writer_luna',
    title: 'El Septimo Silencio',
    synopsis:
      'Una desaparicion imposible obliga a una inspectora a reconstruir una noche de versiones contradictorias, omisiones peligrosas y un silencio que empieza a comportarse como magia oscura.',
    status: NovelStatus.COMPLETED,
    rating: NovelRating.R,
    genreSlugs: ['misterio', 'thriller'],
    warnings: ['Violencia', 'Lenguaje adulto'],
    tags: ['misterio', 'investigacion'],
    isPublic: true,
    viewsCount: 27,
    chapters: silenceChapters,
  });

  const readerAlex = await prisma.user.findUniqueOrThrow({
    where: { username: 'reader_alex' },
  });
  const writerMarcos = await prisma.user.findUniqueOrThrow({
    where: { username: 'writer_marcos' },
  });

  for (const novel of [veil, silence]) {
    await prisma.novelLike.upsert({
      where: {
        novelId_userId: {
          novelId: novel.id,
          userId: readerAlex.id,
        },
      },
      update: {},
      create: {
        novelId: novel.id,
        userId: readerAlex.id,
      },
    });

    await prisma.novelBookmark.upsert({
      where: {
        novelId_userId: {
          novelId: novel.id,
          userId: readerAlex.id,
        },
      },
      update: {},
      create: {
        novelId: novel.id,
        userId: readerAlex.id,
      },
    });
  }

  await prisma.novelLike.upsert({
    where: {
      novelId_userId: {
        novelId: veil.id,
        userId: writerMarcos.id,
      },
    },
    update: {},
    create: {
      novelId: veil.id,
      userId: writerMarcos.id,
    },
  });
}

async function seedReaderLibrary() {
  const [demoWriter, readerAlex] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { username: 'demo_writer' } }),
    prisma.user.findUniqueOrThrow({ where: { username: 'reader_alex' } }),
  ]);

  for (const userId of [demoWriter.id, readerAlex.id]) {
    await prisma.readerPreferences.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        fontFamily: ReaderFontFamily.crimson,
        fontSize: 18,
        lineHeight: 1.8,
        maxWidth: 720,
        readingMode: ReaderMode.scroll,
        showProgress: true,
      },
    });
  }

  const veil = await prisma.novel.findUniqueOrThrow({
    where: { slug: normalizeSlug('Las Cronicas del Velo') },
    include: {
      chapters: {
        orderBy: { order: 'asc' },
      },
    },
  });
  const silence = await prisma.novel.findUniqueOrThrow({
    where: { slug: normalizeSlug('El Septimo Silencio') },
    include: {
      chapters: {
        orderBy: { order: 'asc' },
      },
    },
  });

  const veilChapter2 = veil.chapters.find((chapter) => chapter.order === 2)!;
  const veilChapter1 = veil.chapters.find((chapter) => chapter.order === 1)!;
  const veilChapter3 = veil.chapters.find((chapter) => chapter.order === 3)!;
  const silenceChapter2 = silence.chapters.find(
    (chapter) => chapter.order === 2,
  )!;
  const silenceChapter1 = silence.chapters.find(
    (chapter) => chapter.order === 1,
  )!;

  await prisma.readingProgress.upsert({
    where: {
      userId_novelId: {
        userId: readerAlex.id,
        novelId: veil.id,
      },
    },
    update: {
      chapterId: veilChapter2.id,
      scrollPct: 0.65,
    },
    create: {
      userId: readerAlex.id,
      novelId: veil.id,
      chapterId: veilChapter2.id,
      scrollPct: 0.65,
    },
  });

  await prisma.readingProgress.upsert({
    where: {
      userId_novelId: {
        userId: readerAlex.id,
        novelId: silence.id,
      },
    },
    update: {
      chapterId: silenceChapter2.id,
      scrollPct: 1,
    },
    create: {
      userId: readerAlex.id,
      novelId: silence.id,
      chapterId: silenceChapter2.id,
      scrollPct: 1,
    },
  });

  const historyEntries = [
    {
      novelId: veil.id,
      chapterId: veilChapter1.id,
      openedAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    },
    {
      novelId: veil.id,
      chapterId: veilChapter2.id,
      openedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
    },
    {
      novelId: veil.id,
      chapterId: veilChapter3.id,
      openedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
    {
      novelId: silence.id,
      chapterId: silenceChapter1.id,
      openedAt: new Date(Date.now() - 1000 * 60 * 60 * 50),
    },
    {
      novelId: silence.id,
      chapterId: silenceChapter2.id,
      openedAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
    },
  ];

  for (const entry of historyEntries) {
    const existing = await prisma.readingHistory.findFirst({
      where: {
        userId: readerAlex.id,
        novelId: entry.novelId,
        chapterId: entry.chapterId,
      },
    });

    if (!existing) {
      await prisma.readingHistory.create({
        data: {
          userId: readerAlex.id,
          novelId: entry.novelId,
          chapterId: entry.chapterId,
          openedAt: entry.openedAt,
        },
      });
    }
  }

  const bookmark = await prisma.chapterBookmark.findFirst({
    where: {
      userId: readerAlex.id,
      chapterId: veilChapter2.id,
      label: 'Retomar aqui',
    },
  });

  if (!bookmark) {
    await prisma.chapterBookmark.create({
      data: {
        userId: readerAlex.id,
        novelId: veil.id,
        chapterId: veilChapter2.id,
        label: 'Retomar aqui',
      },
    });
  }

  const highlights = [
    {
      chapterId: veilChapter1.id,
      novelId: veil.id,
      anchorId: 'p-3',
      startOffset: 0,
      endOffset: 50,
      color: HighlightColor.yellow,
      note: null,
    },
    {
      chapterId: veilChapter1.id,
      novelId: veil.id,
      anchorId: 'p-7',
      startOffset: 10,
      endOffset: 80,
      color: HighlightColor.blue,
      note: 'Frase poderosa',
    },
  ];

  for (const entry of highlights) {
    const existing = await prisma.highlight.findFirst({
      where: {
        userId: readerAlex.id,
        chapterId: entry.chapterId,
        anchorId: entry.anchorId,
        startOffset: entry.startOffset,
        endOffset: entry.endOffset,
      },
    });

    if (!existing) {
      await prisma.highlight.create({
        data: {
          userId: readerAlex.id,
          chapterId: entry.chapterId,
          novelId: entry.novelId,
          anchorId: entry.anchorId,
          startOffset: entry.startOffset,
          endOffset: entry.endOffset,
          color: entry.color,
          note: entry.note,
        },
      });
    }
  }

  const epicList = await prisma.readingList.upsert({
    where: {
      id: 'c1ec5d08-0c04-490d-b2c7-6e7e00a00001',
    },
    update: {
      userId: readerAlex.id,
      name: 'Fantasia epica',
      description: 'Historias extensas para leer con tiempo.',
      visibility: ReadingListVisibility.PUBLIC,
    },
    create: {
      id: 'c1ec5d08-0c04-490d-b2c7-6e7e00a00001',
      userId: readerAlex.id,
      name: 'Fantasia epica',
      description: 'Historias extensas para leer con tiempo.',
      visibility: ReadingListVisibility.PUBLIC,
    },
  });

  const pendingList = await prisma.readingList.upsert({
    where: {
      id: 'c1ec5d08-0c04-490d-b2c7-6e7e00a00002',
    },
    update: {
      userId: readerAlex.id,
      name: 'Pendientes',
      description: 'Lo que quiero seguir este mes.',
      visibility: ReadingListVisibility.PRIVATE,
    },
    create: {
      id: 'c1ec5d08-0c04-490d-b2c7-6e7e00a00002',
      userId: readerAlex.id,
      name: 'Pendientes',
      description: 'Lo que quiero seguir este mes.',
      visibility: ReadingListVisibility.PRIVATE,
    },
  });

  await prisma.readingListItem.upsert({
    where: {
      readingListId_novelId: {
        readingListId: epicList.id,
        novelId: veil.id,
      },
    },
    update: {},
    create: {
      readingListId: epicList.id,
      novelId: veil.id,
    },
  });

  await prisma.readingListItem.upsert({
    where: {
      readingListId_novelId: {
        readingListId: pendingList.id,
        novelId: silence.id,
      },
    },
    update: {},
    create: {
      readingListId: pendingList.id,
      novelId: silence.id,
    },
  });

  const now = new Date();
  await prisma.readingGoal.upsert({
    where: {
      userId_year_month: {
        userId: readerAlex.id,
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
      },
    },
    update: {
      targetWords: 50000,
    },
    create: {
      userId: readerAlex.id,
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      targetWords: 50000,
    },
  });
}

async function seedWorldsAndCharacters() {
  const [demoWriter, mateoWorlds, readerAlex] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { username: 'demo_writer' } }),
    prisma.user.findUniqueOrThrow({ where: { username: 'mateo.worlds' } }),
    prisma.user.findUniqueOrThrow({ where: { username: 'reader_alex' } }),
  ]);

  const [veloNovel, silenceNovel] = await Promise.all([
    prisma.novel.findUniqueOrThrow({
      where: { slug: normalizeSlug('Las Cronicas del Velo') },
    }),
    prisma.novel.findUniqueOrThrow({
      where: { slug: normalizeSlug('El Septimo Silencio') },
    }),
  ]);

  const worldSeeds: Array<{
    authorId: string;
    name: string;
    slug: string;
    tagline: string;
    description: string;
    setting: string;
    magicSystem: string;
    rules: string;
    visibility: WorldVisibility;
    tags: string[];
    locations: Array<{
      name: string;
      type: string;
      description: string;
      isNotable: boolean;
    }>;
  }> = [
    {
      authorId: demoWriter.id,
      name: 'El Mundo del Velo',
      slug: 'el-mundo-del-velo',
      tagline: 'Ciudades anfibias, memoria ritual y campanas sumergidas.',
      description:
        'Un mundo costero atravesado por portales de agua negra, linajes de cartografos y deudas que se pagan con recuerdos.',
      setting:
        'Archipielagos brumosos, ciudades-puerto de cobre y rutas ceremoniales entre islas hundidas.',
      magicSystem:
        'El Velo altera el precio de la memoria. Toda travesia importante exige ofrecer nombres, canciones o pasados enteros.',
      rules:
        'Nadie cruza dos veces el mismo umbral sin cambiar. Las campanas solo suenan cuando alguien rompe un juramento antiguo.',
      visibility: WorldVisibility.PUBLIC,
      tags: ['fantasia', 'serial', 'ciudad-puerto'],
      locations: [
        {
          name: 'Nacar de Bruma',
          type: 'capital costera',
          description:
            'Ciudad principal levantada sobre pilotes y puentes de cobre oxidado.',
          isNotable: true,
        },
        {
          name: 'Archivo Sumergido',
          type: 'ruina ritual',
          description:
            'Camara inundada donde los mapas se copian sobre piel mineral.',
          isNotable: true,
        },
        {
          name: 'Puente de las Campanas',
          type: 'frontera',
          description:
            'Paso ceremonial entre la ciudad visible y los corredores del Velo.',
          isNotable: false,
        },
      ],
    },
    {
      authorId: mateoWorlds.id,
      name: 'Aetherya',
      slug: 'aetherya',
      tagline: 'Un continente suspendido por pactos aereos y politica arcana.',
      description:
        'Aetherya esta formado por terrazas celestes, casas de aire y ciudades ancladas a torres de resonancia.',
      setting:
        'Mesetas flotantes, bibliotecas orbitantes y rutas comerciales escoltadas por navegantes del viento.',
      magicSystem:
        'La energia del eter responde a juramentos colectivos y a coralizaciones de cristal vivo.',
      rules:
        'Las ciudades que rompen sus pactos descienden de nivel y pierden acceso a las corrientes superiores.',
      visibility: WorldVisibility.PUBLIC,
      tags: ['fantasia', 'politica', 'aereo'],
      locations: [
        {
          name: 'Heliora',
          type: 'metropoli suspendida',
          description:
            'Capital academica donde se negocian pactos de navegacion y tratados de cristal.',
          isNotable: true,
        },
        {
          name: 'Las Agujas de Cuarzo',
          type: 'frontera',
          description:
            'Cadena de torres vivas que regula el trafico entre estratos del cielo.',
          isNotable: true,
        },
      ],
    },
  ];

  const worldBySlug = new Map<string, { id: string; authorId: string }>();

  for (const entry of worldSeeds) {
    const world = await prisma.world.upsert({
      where: { slug: entry.slug },
      update: {
        authorId: entry.authorId,
        name: entry.name,
        tagline: entry.tagline,
        description: entry.description,
        setting: entry.setting,
        magicSystem: entry.magicSystem,
        rules: entry.rules,
        visibility: entry.visibility,
        tags: entry.tags,
      },
      create: {
        authorId: entry.authorId,
        name: entry.name,
        slug: entry.slug,
        tagline: entry.tagline,
        description: entry.description,
        setting: entry.setting,
        magicSystem: entry.magicSystem,
        rules: entry.rules,
        visibility: entry.visibility,
        tags: entry.tags,
      },
    });

    worldBySlug.set(entry.slug, { id: world.id, authorId: world.authorId });

    for (const location of entry.locations) {
      const existing = await prisma.worldLocation.findFirst({
        where: {
          worldId: world.id,
          name: location.name,
        },
      });

      if (existing) {
        await prisma.worldLocation.update({
          where: { id: existing.id },
          data: {
            type: location.type,
            description: location.description,
            isNotable: location.isNotable,
          },
        });
      } else {
        await prisma.worldLocation.create({
          data: {
            worldId: world.id,
            name: location.name,
            type: location.type,
            description: location.description,
            isNotable: location.isNotable,
          },
        });
      }
    }
  }

  await prisma.novelWorld.upsert({
    where: {
      novelId_worldId: {
        novelId: veloNovel.id,
        worldId: worldBySlug.get('el-mundo-del-velo')!.id,
      },
    },
    update: {},
    create: {
      novelId: veloNovel.id,
      worldId: worldBySlug.get('el-mundo-del-velo')!.id,
    },
  });

  const characterSeeds: Array<{
    authorId: string;
    worldSlug: string;
    name: string;
    slug: string;
    role: CharacterRole;
    status: CharacterStatus;
    age?: string;
    appearance: string;
    personality: string;
    motivations: string;
    fears: string;
    strengths: string;
    weaknesses: string;
    backstory: string;
    arc: string;
    isPublic: boolean;
    tags: string[];
  }> = [
    {
      authorId: demoWriter.id,
      worldSlug: 'el-mundo-del-velo',
      name: 'Kael',
      slug: 'kael',
      role: CharacterRole.PROTAGONIST,
      status: CharacterStatus.ALIVE,
      age: '24',
      appearance:
        'Cabello oscuro, cicatriz leve en la sien y manos marcadas por tinta ritual.',
      personality: 'Observador, terco, brillante bajo presion.',
      motivations:
        'Descifrar el origen del Velo y recuperar una memoria perdida de su familia.',
      fears: 'Olvidar a quien juraba proteger.',
      strengths: 'Cartografia simbolica, improvisacion, resistencia emocional.',
      weaknesses: 'Impulsividad, orgullo y tendencia al sacrificio silencioso.',
      backstory:
        'Heredero accidental de una linea de cartografos que fueron borrados de los registros oficiales.',
      arc: 'Aprende que guiar a otros exige compartir el peso del mapa, no cargarlo solo.',
      isPublic: true,
      tags: ['protagonista', 'cartografo'],
    },
    {
      authorId: demoWriter.id,
      worldSlug: 'el-mundo-del-velo',
      name: 'El Tejedor',
      slug: 'el-tejedor',
      role: CharacterRole.ANTAGONIST,
      status: CharacterStatus.UNKNOWN,
      appearance:
        'Figura cubierta por velos minerales y fibras negras que vibran con las campanas.',
      personality: 'Paciente, calculador, ceremonial.',
      motivations:
        'Reescribir las rutas del mundo para controlar cada deuda de memoria.',
      fears: 'Perder el monopolio sobre los nombres verdaderos.',
      strengths: 'Magia ritual, estrategia de largo plazo.',
      weaknesses: 'Obsesion con el control y desprecio por el azar.',
      backstory:
        'Ultimo guardian de una orden que cree que la historia debe pertenecer solo a quienes pueden pagarla.',
      arc: 'Su dominio empieza a fracturarse cuando los mapas dejan de obedecerle.',
      isPublic: true,
      tags: ['antagonista', 'ritual'],
    },
    {
      authorId: mateoWorlds.id,
      worldSlug: 'aetherya',
      name: 'Seren',
      slug: 'seren',
      role: CharacterRole.MENTOR,
      status: CharacterStatus.ALIVE,
      appearance:
        'Abrigo azul pizarra, baston de cuarzo y una libreta de pactos bordada en plata.',
      personality: 'Didactica, incisiva, estratega.',
      motivations:
        'Evitar la caida politica de Heliora sin repetir las guerras de sus maestros.',
      fears: 'Que sus alumnos hereden un cielo dividido.',
      strengths: 'Diplomacia, lectura politica, memoria prodigiosa.',
      weaknesses: 'Control excesivo y dificultad para delegar.',
      backstory:
        'Arquitecta de pactos que negocia entre ciudades flotantes desde hace veinte anos.',
      arc: 'Acepta ceder protagonismo a una nueva generacion de navegantes.',
      isPublic: true,
      tags: ['mentora', 'politica'],
    },
    {
      authorId: mateoWorlds.id,
      worldSlug: 'aetherya',
      name: 'Lyra',
      slug: 'lyra',
      role: CharacterRole.ALLY,
      status: CharacterStatus.ALIVE,
      appearance:
        'Cabello trenzado con cristal vivo y uniforme de navegante del viento.',
      personality: 'Audaz, ironica, ferozmente leal.',
      motivations:
        'Demostrar que los barrios bajos del cielo tambien pueden dirigir rutas mayores.',
      fears: 'Ser usada como simbolo y no como persona.',
      strengths: 'Navegacion, combate aereo, intuicion tactica.',
      weaknesses: 'Impaciencia y desconfianza de las instituciones.',
      backstory:
        'Piloto de convoyes que ascendio desde las plataformas inferiores hasta la escolta diplomatica.',
      arc: 'Transforma su rebeldia en liderazgo colectivo.',
      isPublic: true,
      tags: ['aliada', 'navegante'],
    },
  ];

  const characterIds = new Map<string, { id: string; authorId: string }>();

  for (const entry of characterSeeds) {
    const worldId = worldBySlug.get(entry.worldSlug)?.id ?? null;

    const character = await prisma.character.upsert({
      where: {
        authorId_slug: {
          authorId: entry.authorId,
          slug: entry.slug,
        },
      },
      update: {
        worldId,
        name: entry.name,
        role: entry.role,
        status: entry.status,
        age: entry.age,
        appearance: entry.appearance,
        personality: entry.personality,
        motivations: entry.motivations,
        fears: entry.fears,
        strengths: entry.strengths,
        weaknesses: entry.weaknesses,
        backstory: entry.backstory,
        arc: entry.arc,
        isPublic: entry.isPublic,
        tags: entry.tags,
      },
      create: {
        authorId: entry.authorId,
        worldId,
        name: entry.name,
        slug: entry.slug,
        role: entry.role,
        status: entry.status,
        age: entry.age,
        appearance: entry.appearance,
        personality: entry.personality,
        motivations: entry.motivations,
        fears: entry.fears,
        strengths: entry.strengths,
        weaknesses: entry.weaknesses,
        backstory: entry.backstory,
        arc: entry.arc,
        isPublic: entry.isPublic,
        tags: entry.tags,
      },
    });

    characterIds.set(entry.slug, {
      id: character.id,
      authorId: character.authorId,
    });
  }

  const relationships: Array<{
    sourceSlug: string;
    targetSlug: string;
    type: string;
    description: string;
    isMutual: boolean;
  }> = [
    {
      sourceSlug: 'kael',
      targetSlug: 'el-tejedor',
      type: 'enemistad',
      description:
        'El Tejedor necesita a Kael para reactivar rutas selladas del Velo.',
      isMutual: true,
    },
    {
      sourceSlug: 'seren',
      targetSlug: 'lyra',
      type: 'mentoria',
      description:
        'Seren entreno a Lyra para convertir intuicion en estrategia.',
      isMutual: false,
    },
  ];

  for (const relationship of relationships) {
    const source = characterIds.get(relationship.sourceSlug);
    const target = characterIds.get(relationship.targetSlug);

    if (!source || !target) {
      continue;
    }

    await prisma.characterRelationship.upsert({
      where: {
        sourceId_targetId_type: {
          sourceId: source.id,
          targetId: target.id,
          type: relationship.type,
        },
      },
      update: {
        description: relationship.description,
        isMutual: relationship.isMutual,
      },
      create: {
        sourceId: source.id,
        targetId: target.id,
        type: relationship.type,
        description: relationship.description,
        isMutual: relationship.isMutual,
      },
    });

    if (relationship.isMutual) {
      await prisma.characterRelationship.upsert({
        where: {
          sourceId_targetId_type: {
            sourceId: target.id,
            targetId: source.id,
            type: relationship.type,
          },
        },
        update: {
          description: relationship.description,
          isMutual: true,
        },
        create: {
          sourceId: target.id,
          targetId: source.id,
          type: relationship.type,
          description: relationship.description,
          isMutual: true,
        },
      });
    }
  }

  const novelCharacterLinks: Array<{
    novelId: string;
    characterSlug: string;
    roleInNovel: CharacterRole;
  }> = [
    {
      novelId: veloNovel.id,
      characterSlug: 'kael',
      roleInNovel: CharacterRole.PROTAGONIST,
    },
    {
      novelId: veloNovel.id,
      characterSlug: 'el-tejedor',
      roleInNovel: CharacterRole.ANTAGONIST,
    },
    {
      novelId: silenceNovel.id,
      characterSlug: 'seren',
      roleInNovel: CharacterRole.MENTOR,
    },
    {
      novelId: silenceNovel.id,
      characterSlug: 'lyra',
      roleInNovel: CharacterRole.ALLY,
    },
  ];

  for (const link of novelCharacterLinks) {
    const character = characterIds.get(link.characterSlug);
    if (!character) {
      continue;
    }

    await prisma.novelCharacter.upsert({
      where: {
        novelId_characterId: {
          novelId: link.novelId,
          characterId: character.id,
        },
      },
      update: {
        roleInNovel: link.roleInNovel,
      },
      create: {
        novelId: link.novelId,
        characterId: character.id,
        roleInNovel: link.roleInNovel,
      },
    });
  }

  await prisma.novelBookmark.upsert({
    where: {
      novelId_userId: {
        novelId: veloNovel.id,
        userId: readerAlex.id,
      },
    },
    update: {},
    create: {
      novelId: veloNovel.id,
      userId: readerAlex.id,
    },
  });
}

async function seedWorldbuilding() {
  const demoWriter = await prisma.user.findUniqueOrThrow({
    where: { username: 'demo_writer' },
  });
  const mateoWorlds = await prisma.user.findUniqueOrThrow({
    where: { username: 'mateo.worlds' },
  });

  const veloWorld = await prisma.world.findUniqueOrThrow({
    where: { slug: 'el-mundo-del-velo' },
  });
  const aetheryaWorld = await prisma.world.findUniqueOrThrow({
    where: { slug: 'aetherya' },
  });

  // ---- Categories for el-mundo-del-velo ----
  const racesCategory = await prisma.wbCategory.upsert({
    where: { worldId_slug: { worldId: veloWorld.id, slug: 'razas' } },
    update: {
      name: 'Razas',
      icon: '\u{1F465}',
      color: '#8b5cf6',
      description: 'Razas y pueblos del mundo del Velo.',
      sortOrder: 1,
    },
    create: {
      worldId: veloWorld.id,
      name: 'Razas',
      slug: 'razas',
      icon: '\u{1F465}',
      color: '#8b5cf6',
      description: 'Razas y pueblos del mundo del Velo.',
      fieldSchema: [
        {
          key: 'origin',
          label: 'Origen',
          type: 'textarea',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 1,
        },
        {
          key: 'traits',
          label: 'Rasgos',
          type: 'textarea',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 2,
        },
        {
          key: 'lifespan',
          label: 'Esperanza de vida',
          type: 'text',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 3,
        },
        {
          key: 'population',
          label: 'Poblacion',
          type: 'text',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 4,
        },
        {
          key: 'is_extinct',
          label: 'Extinta',
          type: 'boolean',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 5,
        },
      ],
      sortOrder: 1,
      isSystem: false,
    },
  });

  const citiesCategory = await prisma.wbCategory.upsert({
    where: { worldId_slug: { worldId: veloWorld.id, slug: 'ciudades' } },
    update: {
      name: 'Ciudades',
      icon: '\u{1F3D9}\uFE0F',
      color: '#3db05a',
      description: 'Ciudades y asentamientos del mundo del Velo.',
      sortOrder: 2,
    },
    create: {
      worldId: veloWorld.id,
      name: 'Ciudades',
      slug: 'ciudades',
      icon: '\u{1F3D9}\uFE0F',
      color: '#3db05a',
      description: 'Ciudades y asentamientos del mundo del Velo.',
      fieldSchema: [
        {
          key: 'region',
          label: 'Region',
          type: 'text',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 1,
        },
        {
          key: 'population',
          label: 'Poblacion',
          type: 'text',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 2,
        },
        {
          key: 'government',
          label: 'Gobierno',
          type: 'text',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 3,
        },
        {
          key: 'current_status',
          label: 'Estado actual',
          type: 'select',
          required: false,
          placeholder: null,
          options: [
            'Floreciente',
            'En decadencia',
            'Destruida',
            'Abandonada',
            'Legendaria',
            'Desconocida',
          ],
          default: null,
          sortOrder: 4,
        },
      ],
      sortOrder: 2,
      isSystem: false,
    },
  });

  const magicCategory = await prisma.wbCategory.upsert({
    where: { worldId_slug: { worldId: veloWorld.id, slug: 'magia' } },
    update: {
      name: 'Magia',
      icon: '\u2728',
      color: '#c9a84c',
      description: 'Sistemas de magia del Velo.',
      sortOrder: 3,
    },
    create: {
      worldId: veloWorld.id,
      name: 'Magia',
      slug: 'magia',
      icon: '\u2728',
      color: '#c9a84c',
      description: 'Sistemas de magia del Velo.',
      fieldSchema: [
        {
          key: 'source',
          label: 'Fuente',
          type: 'textarea',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 1,
        },
        {
          key: 'limitations',
          label: 'Limitaciones',
          type: 'textarea',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 2,
        },
        {
          key: 'power_level',
          label: 'Nivel de poder',
          type: 'select',
          required: false,
          placeholder: null,
          options: ['Menor', 'Moderado', 'Mayor', 'Legendario'],
          default: null,
          sortOrder: 3,
        },
        {
          key: 'is_learnable',
          label: 'Se puede aprender',
          type: 'boolean',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 4,
        },
      ],
      sortOrder: 3,
      isSystem: false,
    },
  });

  const loreCategory = await prisma.wbCategory.upsert({
    where: { worldId_slug: { worldId: veloWorld.id, slug: 'lore' } },
    update: {
      name: 'Lore',
      icon: '\u{1F4DC}',
      color: '#9088a0',
      description: 'Historia y leyendas del mundo del Velo.',
      sortOrder: 4,
    },
    create: {
      worldId: veloWorld.id,
      name: 'Lore',
      slug: 'lore',
      icon: '\u{1F4DC}',
      color: '#9088a0',
      description: 'Historia y leyendas del mundo del Velo.',
      fieldSchema: [
        {
          key: 'date_in_world',
          label: 'Fecha en el mundo',
          type: 'text',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 1,
        },
        {
          key: 'participants',
          label: 'Participantes',
          type: 'textarea',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 2,
        },
        {
          key: 'consequences',
          label: 'Consecuencias',
          type: 'textarea',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 3,
        },
        {
          key: 'is_verified',
          label: 'Verificado',
          type: 'boolean',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 4,
        },
      ],
      sortOrder: 4,
      isSystem: false,
    },
  });

  // ---- Entries for el-mundo-del-velo ----
  const entryCartografos = await prisma.wbEntry.upsert({
    where: {
      worldId_slug: { worldId: veloWorld.id, slug: 'cartografos-del-velo' },
    },
    update: {
      name: 'Cartografos del Velo',
      summary: 'Linaje ancestral que traza rutas entre umbrales de agua negra.',
      fields: {
        origin: 'Se remontan a la primera apertura del Velo.',
        traits: 'Marcas de tinta ritual en las manos. Memoria prodigiosa.',
        lifespan: '80-120 anos',
        is_extinct: false,
      },
      tags: ['linaje', 'cartografia', 'ritual'],
      isPublic: true,
      sortOrder: 1,
    },
    create: {
      worldId: veloWorld.id,
      categoryId: racesCategory.id,
      authorId: demoWriter.id,
      name: 'Cartografos del Velo',
      slug: 'cartografos-del-velo',
      summary: 'Linaje ancestral que traza rutas entre umbrales de agua negra.',
      content:
        'Los Cartografos del Velo son un linaje casi extinto que custodia los mapas vivos del mundo sumergido. Sus miembros nacen con marcas rituales que permiten leer corrientes invisibles y trazar caminos entre portales.',
      fields: {
        origin: 'Se remontan a la primera apertura del Velo.',
        traits: 'Marcas de tinta ritual en las manos. Memoria prodigiosa.',
        lifespan: '80-120 anos',
        is_extinct: false,
      },
      tags: ['linaje', 'cartografia', 'ritual'],
      isPublic: true,
      sortOrder: 1,
    },
  });

  const entryNacar = await prisma.wbEntry.upsert({
    where: { worldId_slug: { worldId: veloWorld.id, slug: 'nacar-de-bruma' } },
    update: {
      name: 'Nacar de Bruma',
      summary:
        'Capital costera levantada sobre pilotes de cobre y puentes ceremoniales.',
      fields: {
        region: 'Archipielago central',
        population: '~45.000',
        government: 'Consejo de Campanas',
        current_status: 'Floreciente',
      },
      tags: ['capital', 'puerto', 'cobre'],
      isPublic: true,
      sortOrder: 1,
    },
    create: {
      worldId: veloWorld.id,
      categoryId: citiesCategory.id,
      authorId: demoWriter.id,
      name: 'Nacar de Bruma',
      slug: 'nacar-de-bruma',
      summary:
        'Capital costera levantada sobre pilotes de cobre y puentes ceremoniales.',
      content:
        'Nacar de Bruma es la ciudad mas grande del mundo del Velo, construida sobre una red de pilotes en el delta de tres rios que desembocan en agua negra. Sus tejados de cobre oxidado brillan con un verde particular al atardecer.',
      fields: {
        region: 'Archipielago central',
        population: '~45.000',
        government: 'Consejo de Campanas',
        current_status: 'Floreciente',
      },
      tags: ['capital', 'puerto', 'cobre'],
      isPublic: true,
      sortOrder: 1,
    },
  });

  const entryArchivoSumergido = await prisma.wbEntry.upsert({
    where: {
      worldId_slug: { worldId: veloWorld.id, slug: 'archivo-sumergido' },
    },
    update: {
      name: 'Archivo Sumergido',
      summary: 'Camara subacuatica donde se conservan los mapas mas antiguos.',
      fields: {
        region: 'Profundidades del delta',
        population: 'Ninguna permanente',
        government: 'Sin gobierno',
        current_status: 'Legendaria',
      },
      tags: ['ruina', 'mapas', 'ritual'],
      isPublic: true,
      sortOrder: 2,
    },
    create: {
      worldId: veloWorld.id,
      categoryId: citiesCategory.id,
      authorId: demoWriter.id,
      name: 'Archivo Sumergido',
      slug: 'archivo-sumergido',
      summary: 'Camara subacuatica donde se conservan los mapas mas antiguos.',
      content:
        'El Archivo Sumergido es una estructura parcialmente inundada en la que los cartografos copiaban rutas sobre piel mineral. Solo quienes portan las marcas rituales pueden respirar en sus salas mas profundas.',
      fields: {
        region: 'Profundidades del delta',
        population: 'Ninguna permanente',
        government: 'Sin gobierno',
        current_status: 'Legendaria',
      },
      tags: ['ruina', 'mapas', 'ritual'],
      isPublic: true,
      sortOrder: 2,
    },
  });

  const entryMagiaDeLasDeudas = await prisma.wbEntry.upsert({
    where: {
      worldId_slug: { worldId: veloWorld.id, slug: 'magia-de-las-deudas' },
    },
    update: {
      name: 'Magia de las Deudas',
      summary: 'Sistema donde toda travesia exige ofrecer recuerdos como pago.',
      fields: {
        source: 'El Velo mismo: una membrana entre realidades.',
        limitations: 'Cada uso borra fragmentos de memoria personal.',
        power_level: 'Mayor',
        is_learnable: false,
      },
      tags: ['sistema-magico', 'memoria', 'deuda'],
      isPublic: true,
      sortOrder: 1,
    },
    create: {
      worldId: veloWorld.id,
      categoryId: magicCategory.id,
      authorId: demoWriter.id,
      name: 'Magia de las Deudas',
      slug: 'magia-de-las-deudas',
      summary: 'Sistema donde toda travesia exige ofrecer recuerdos como pago.',
      content:
        'La magia del Velo no se aprende ni se hereda: se negocia. Cada vez que alguien cruza un umbral debe ofrecer algo personal, normalmente un recuerdo, un nombre o una cancion. El precio sube con la distancia y con la importancia del destino.',
      fields: {
        source: 'El Velo mismo: una membrana entre realidades.',
        limitations: 'Cada uso borra fragmentos de memoria personal.',
        power_level: 'Mayor',
        is_learnable: false,
      },
      tags: ['sistema-magico', 'memoria', 'deuda'],
      isPublic: true,
      sortOrder: 1,
    },
  });

  const entryCartaDelSilencio = await prisma.wbEntry.upsert({
    where: {
      worldId_slug: { worldId: veloWorld.id, slug: 'carta-del-silencio' },
    },
    update: {
      name: 'Carta del Silencio',
      summary:
        'Ritual magico que permite comunicarse sin palabras a traves del Velo.',
      fields: {
        source: 'Derivada de la Magia de las Deudas.',
        limitations:
          'Solo funciona entre personas que comparten un recuerdo perdido.',
        power_level: 'Menor',
        is_learnable: true,
      },
      tags: ['ritual', 'comunicacion', 'silencio'],
      isPublic: true,
      sortOrder: 2,
    },
    create: {
      worldId: veloWorld.id,
      categoryId: magicCategory.id,
      authorId: demoWriter.id,
      name: 'Carta del Silencio',
      slug: 'carta-del-silencio',
      summary:
        'Ritual magico que permite comunicarse sin palabras a traves del Velo.',
      content:
        'La Carta del Silencio es un metodo de comunicacion ritual que nacio como efecto secundario de la Magia de las Deudas. Dos personas que hayan perdido el mismo recuerdo pueden intercambiar impresiones a traves del Velo sin hablar.',
      fields: {
        source: 'Derivada de la Magia de las Deudas.',
        limitations:
          'Solo funciona entre personas que comparten un recuerdo perdido.',
        power_level: 'Menor',
        is_learnable: true,
      },
      tags: ['ritual', 'comunicacion', 'silencio'],
      isPublic: true,
      sortOrder: 2,
    },
  });

  const entryPrimeraApertura = await prisma.wbEntry.upsert({
    where: {
      worldId_slug: { worldId: veloWorld.id, slug: 'la-primera-apertura' },
    },
    update: {
      name: 'La Primera Apertura',
      summary:
        'Evento mitico que dio origen al Velo y a las rutas entre mundos.',
      fields: {
        date_in_world: 'Era Cero, ciclo desconocido',
        participants: 'Los Fundadores sin nombre',
        consequences:
          'Creacion de las rutas, nacimiento de los Cartografos, perdida del idioma original.',
        is_verified: false,
      },
      tags: ['evento', 'mito', 'fundacion'],
      isPublic: true,
      sortOrder: 1,
    },
    create: {
      worldId: veloWorld.id,
      categoryId: loreCategory.id,
      authorId: demoWriter.id,
      name: 'La Primera Apertura',
      slug: 'la-primera-apertura',
      summary:
        'Evento mitico que dio origen al Velo y a las rutas entre mundos.',
      content:
        'Nadie sabe con certeza cuando ocurrio la Primera Apertura. Los relatos fragmentarios hablan de un grupo de navegantes que encontraron un punto donde el agua dejaba de reflejar el cielo y empezaba a mostrar otro lugar.',
      fields: {
        date_in_world: 'Era Cero, ciclo desconocido',
        participants: 'Los Fundadores sin nombre',
        consequences:
          'Creacion de las rutas, nacimiento de los Cartografos, perdida del idioma original.',
        is_verified: false,
      },
      tags: ['evento', 'mito', 'fundacion'],
      isPublic: true,
      sortOrder: 1,
    },
  });

  // ---- 3 cross-reference links ----
  const linkData = [
    {
      source: entryCartografos,
      target: entryMagiaDeLasDeudas,
      relation: 'usa',
      isMutual: false,
    },
    {
      source: entryNacar,
      target: entryArchivoSumergido,
      relation: 'contiene',
      isMutual: false,
    },
    {
      source: entryMagiaDeLasDeudas,
      target: entryCartaDelSilencio,
      relation: 'deriva en',
      isMutual: true,
    },
  ];

  for (const ld of linkData) {
    await prisma.wbEntryLink.upsert({
      where: {
        sourceId_targetId_relation: {
          sourceId: ld.source.id,
          targetId: ld.target.id,
          relation: ld.relation,
        },
      },
      update: { isMutual: ld.isMutual },
      create: {
        sourceId: ld.source.id,
        targetId: ld.target.id,
        relation: ld.relation,
        isMutual: ld.isMutual,
      },
    });

    if (ld.isMutual) {
      await prisma.wbEntryLink.upsert({
        where: {
          sourceId_targetId_relation: {
            sourceId: ld.target.id,
            targetId: ld.source.id,
            relation: ld.relation,
          },
        },
        update: { isMutual: true },
        create: {
          sourceId: ld.target.id,
          targetId: ld.source.id,
          relation: ld.relation,
          isMutual: true,
        },
      });
    }
  }

  // ---- 1 category + 1 entry for aetherya ----
  const aethFactions = await prisma.wbCategory.upsert({
    where: { worldId_slug: { worldId: aetheryaWorld.id, slug: 'facciones' } },
    update: {
      name: 'Facciones',
      icon: '\u{1F3DB}\uFE0F',
      color: '#50c87a',
      description: 'Organizaciones y facciones de Aetherya.',
      sortOrder: 1,
    },
    create: {
      worldId: aetheryaWorld.id,
      name: 'Facciones',
      slug: 'facciones',
      icon: '\u{1F3DB}\uFE0F',
      color: '#50c87a',
      description: 'Organizaciones y facciones de Aetherya.',
      fieldSchema: [
        {
          key: 'founded',
          label: 'Fundacion',
          type: 'text',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 1,
        },
        {
          key: 'leader',
          label: 'Lider',
          type: 'text',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 2,
        },
        {
          key: 'headquarters',
          label: 'Sede',
          type: 'text',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 3,
        },
        {
          key: 'goals',
          label: 'Objetivos',
          type: 'textarea',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 4,
        },
        {
          key: 'is_active',
          label: 'Activa',
          type: 'boolean',
          required: false,
          placeholder: null,
          options: null,
          default: null,
          sortOrder: 5,
        },
      ],
      sortOrder: 1,
      isSystem: false,
    },
  });

  await prisma.wbEntry.upsert({
    where: {
      worldId_slug: {
        worldId: aetheryaWorld.id,
        slug: 'senado-de-las-corrientes',
      },
    },
    update: {
      name: 'Senado de las Corrientes',
      summary:
        'Organo politico que regula el trafico aereo y los pactos entre ciudades flotantes.',
      fields: {
        founded: 'Hace 200 ciclos',
        leader: 'Rotativo entre tres casas',
        headquarters: 'Heliora',
        goals: 'Mantener el equilibrio entre estratos del cielo.',
        is_active: true,
      },
      tags: ['gobierno', 'politica', 'aereo'],
      isPublic: true,
      sortOrder: 1,
    },
    create: {
      worldId: aetheryaWorld.id,
      categoryId: aethFactions.id,
      authorId: mateoWorlds.id,
      name: 'Senado de las Corrientes',
      slug: 'senado-de-las-corrientes',
      summary:
        'Organo politico que regula el trafico aereo y los pactos entre ciudades flotantes.',
      content:
        'El Senado de las Corrientes fue establecido despues de la Guerra de los Vientos como organo de mediacion. Se reune en la torre central de Heliora y sus decisiones determinan que ciudades pueden acceder a las corrientes superiores.',
      fields: {
        founded: 'Hace 200 ciclos',
        leader: 'Rotativo entre tres casas',
        headquarters: 'Heliora',
        goals: 'Mantener el equilibrio entre estratos del cielo.',
        is_active: true,
      },
      tags: ['gobierno', 'politica', 'aereo'],
      isPublic: true,
      sortOrder: 1,
    },
  });
}

async function seedSearchHistory() {
  const readerAlex = await prisma.user.findUniqueOrThrow({
    where: { username: 'reader_alex' },
  });

  const entries = ['cronicas', 'fantasia'] as const;

  for (const query of entries) {
    await prisma.searchHistory.upsert({
      where: {
        userId_query: {
          userId: readerAlex.id,
          query,
        },
      },
      update: {
        createdAt: new Date(),
      },
      create: {
        userId: readerAlex.id,
        query,
      },
    });
  }
}

async function seedTimelineAndPlanner() {
  const demoWriter = await prisma.user.findUniqueOrThrow({
    where: { username: 'demo_writer' },
  });
  const novel = await prisma.novel.findFirst({
    where: { authorId: demoWriter.id, slug: { contains: 'cronicas' } },
  });
  if (!novel) return;

  const kael = await prisma.character.findFirst({
    where: { authorId: demoWriter.id, slug: 'kael' },
  });
  const tejedor = await prisma.character.findFirst({
    where: { authorId: demoWriter.id, slug: 'el-tejedor' },
  });

  // ── Timeline ──
  const timeline = await prisma.timeline.upsert({
    where: { authorId_novelId: { authorId: demoWriter.id, novelId: novel.id } },
    update: {
      name: 'Timeline de Las Cronicas del Velo',
      description: 'Cronologia de los eventos del mundo del Velo',
    },
    create: {
      authorId: demoWriter.id,
      novelId: novel.id,
      name: 'Timeline de Las Cronicas del Velo',
      description: 'Cronologia de los eventos del mundo del Velo',
    },
  });

  const timelineEvents = [
    {
      sortOrder: 1,
      title: 'El primer desgarro del Velo',
      type: 'WORLD_EVENT' as const,
      relevance: 'CRITICAL' as const,
      dateLabel: 'Ano 0 del Velo',
      description: 'El momento en que la membrana se rompio por primera vez',
      characterId: null,
    },
    {
      sortOrder: 2,
      title: 'Fundacion del Consejo de los Anclados',
      type: 'WORLD_EVENT' as const,
      relevance: 'MAJOR' as const,
      dateLabel: 'Ano 12 del Velo',
      description: null,
      characterId: null,
    },
    {
      sortOrder: 3,
      title: 'Nacimiento de Kael',
      type: 'CHARACTER_ARC' as const,
      relevance: 'MINOR' as const,
      dateLabel: 'Ano 280 del Velo',
      description: null,
      characterId: kael?.id ?? null,
    },
    {
      sortOrder: 4,
      title: 'El Tejedor cruza el Velo por primera vez',
      type: 'CHARACTER_ARC' as const,
      relevance: 'MAJOR' as const,
      dateLabel: 'Ano 298 del Velo',
      description: null,
      characterId: tejedor?.id ?? null,
    },
    {
      sortOrder: 5,
      title: 'Kael descubre su habilidad',
      type: 'STORY_EVENT' as const,
      relevance: 'CRITICAL' as const,
      dateLabel: 'Ano 302 del Velo, Capitulo 1',
      description: null,
      characterId: kael?.id ?? null,
    },
    {
      sortOrder: 6,
      title: 'El umbral comienza a debilitarse',
      type: 'WORLD_EVENT' as const,
      relevance: 'MAJOR' as const,
      dateLabel: 'Ano 302 del Velo',
      description: null,
      characterId: null,
    },
  ];

  for (const evt of timelineEvents) {
    const existing = await prisma.timelineEvent.findFirst({
      where: { timelineId: timeline.id, title: evt.title },
    });
    if (existing) {
      await prisma.timelineEvent.update({
        where: { id: existing.id },
        data: {
          sortOrder: evt.sortOrder,
          type: evt.type,
          relevance: evt.relevance,
          dateLabel: evt.dateLabel,
          description: evt.description,
          characterId: evt.characterId,
        },
      });
    } else {
      await prisma.timelineEvent.create({
        data: {
          timelineId: timeline.id,
          authorId: demoWriter.id,
          title: evt.title,
          sortOrder: evt.sortOrder,
          type: evt.type,
          relevance: evt.relevance,
          dateLabel: evt.dateLabel,
          description: evt.description,
          characterId: evt.characterId,
        },
      });
    }
  }

  // ── Planner ──
  let project = await prisma.writingProject.findFirst({
    where: { authorId: demoWriter.id, novelId: novel.id },
  });
  if (!project) {
    project = await prisma.writingProject.create({
      data: {
        authorId: demoWriter.id,
        novelId: novel.id,
        name: 'Las Cronicas del Velo — Planner',
        color: '#c9a84c',
      },
    });
  } else {
    await prisma.writingProject.update({
      where: { id: project.id },
      data: { name: 'Las Cronicas del Velo — Planner', color: '#c9a84c' },
    });
  }

  const now = new Date();
  const tasks = [
    {
      title: 'Escribir Cap. 15 — Los hilos rotos',
      type: 'CHAPTER' as const,
      priority: 'HIGH' as const,
      status: 'IN_PROGRESS' as const,
      targetWords: 3000,
      actualWords: 1240,
      dueDate: new Date(now.getTime() + 7 * 86400000),
      completedAt: null,
      sortOrder: 1,
    },
    {
      title: 'Revisar arco de Seren — consistencia emocional',
      type: 'REVISION' as const,
      priority: 'MEDIUM' as const,
      status: 'IN_PROGRESS' as const,
      targetWords: null,
      actualWords: null,
      dueDate: null,
      completedAt: null,
      sortOrder: 2,
    },
    {
      title: 'Desarrollar historia de origen del Tejedor',
      type: 'WORLDBUILDING' as const,
      priority: 'HIGH' as const,
      status: 'BACKLOG' as const,
      targetWords: null,
      actualWords: null,
      dueDate: null,
      completedAt: null,
      sortOrder: 1,
    },
    {
      title: 'Mapa del Mundo del Velo',
      type: 'WORLDBUILDING' as const,
      priority: 'MEDIUM' as const,
      status: 'BACKLOG' as const,
      targetWords: null,
      actualWords: null,
      dueDate: null,
      completedAt: null,
      sortOrder: 2,
    },
    {
      title: 'Definir reglas del cruce del Velo',
      type: 'PLANNING' as const,
      priority: 'LOW' as const,
      status: 'BACKLOG' as const,
      targetWords: null,
      actualWords: null,
      dueDate: null,
      completedAt: null,
      sortOrder: 3,
    },
    {
      title: 'Cap. 14 — segunda lectura y edicion',
      type: 'REVISION' as const,
      priority: 'HIGH' as const,
      status: 'REVIEW' as const,
      targetWords: null,
      actualWords: null,
      dueDate: null,
      completedAt: null,
      sortOrder: 1,
    },
    {
      title: 'Publicar Cap. 14 — El umbral',
      type: 'PUBLICATION' as const,
      priority: 'HIGH' as const,
      status: 'DONE' as const,
      targetWords: null,
      actualWords: null,
      dueDate: null,
      completedAt: new Date(now.getTime() - 2 * 86400000),
      sortOrder: 1,
    },
    {
      title: 'Ficha de personaje: El Tejedor',
      type: 'CHARACTER' as const,
      priority: 'MEDIUM' as const,
      status: 'DONE' as const,
      targetWords: null,
      actualWords: null,
      dueDate: null,
      completedAt: new Date(now.getTime() - 7 * 86400000),
      sortOrder: 2,
    },
  ];

  for (const t of tasks) {
    const existing = await prisma.writingTask.findFirst({
      where: { projectId: project.id, title: t.title },
    });
    if (existing) {
      await prisma.writingTask.update({
        where: { id: existing.id },
        data: {
          type: t.type,
          priority: t.priority,
          status: t.status,
          targetWords: t.targetWords,
          actualWords: t.actualWords,
          dueDate: t.dueDate,
          completedAt: t.completedAt,
          sortOrder: t.sortOrder,
        },
      });
    } else {
      await prisma.writingTask.create({
        data: {
          projectId: project.id,
          authorId: demoWriter.id,
          title: t.title,
          type: t.type,
          priority: t.priority,
          status: t.status,
          targetWords: t.targetWords,
          actualWords: t.actualWords,
          dueDate: t.dueDate,
          completedAt: t.completedAt,
          sortOrder: t.sortOrder,
        },
      });
    }
  }
}

async function seedForumAndSettings() {
  const demoWriter = await prisma.user.findUniqueOrThrow({
    where: { username: 'demo_writer' },
  });
  const writerLuna = await prisma.user.findUniqueOrThrow({
    where: { username: 'writer_luna' },
  });
  const readerAlex = await prisma.user.findUniqueOrThrow({
    where: { username: 'reader_alex' },
  });
  const writerMarcos = await prisma.user.findUniqueOrThrow({
    where: { username: 'writer_marcos' },
  });

  // ── Forum Threads ──
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 300);

  let thread1 = await prisma.forumThread.findFirst({
    where: {
      slug: slugify('Como construis el sistema de magia de vuestras historias'),
    },
  });
  if (!thread1) {
    thread1 = await prisma.forumThread.create({
      data: {
        authorId: demoWriter.id,
        category: 'WRITING_TIPS',
        title: 'Como construis el sistema de magia de vuestras historias?',
        slug: slugify(
          'Como construis el sistema de magia de vuestras historias',
        ),
        content:
          '## Sistemas de magia\n\nEstoy desarrollando un sistema de magia basado en el sacrificio de recuerdos. Me pregunto como otros autores abordan la creacion de sus sistemas magicos.\n\n- Partis de las limitaciones o de las posibilidades?\n- Usais alguna estructura (ley de Sanderson, etc.)?\n- Como evitais el deus ex machina?\n\nMe encantaria leer vuestras experiencias.',
        status: 'OPEN',
        tags: { create: [{ tag: 'magia' }, { tag: 'world-building' }] },
      },
    });
  }

  let thread2 = await prisma.forumThread.findFirst({
    where: { slug: slugify('Feedback para El Septimo Silencio Capitulo 1') },
  });
  if (!thread2) {
    thread2 = await prisma.forumThread.create({
      data: {
        authorId: writerLuna.id,
        category: 'FEEDBACK',
        title: 'Feedback para El Septimo Silencio — Capitulo 1',
        slug: slugify('Feedback para El Septimo Silencio Capitulo 1'),
        content:
          '## Primer capitulo\n\nAcabo de publicar el primer capitulo de mi nueva novela. Me gustaria recibir feedback honesto sobre:\n\n1. El ritmo narrativo\n2. La voz del personaje principal\n3. El hook inicial\n\nGracias de antemano!',
        status: 'OPEN',
        tags: { create: [{ tag: 'feedback' }, { tag: 'revision' }] },
      },
    });

    // Create poll for thread2
    const existingPoll = await prisma.forumPoll.findUnique({
      where: { threadId: thread2.id },
    });
    if (!existingPoll) {
      const poll = await prisma.forumPoll.create({
        data: {
          threadId: thread2.id,
          question: 'Como calificarias el primer capitulo?',
          status: 'OPEN',
          options: {
            create: [
              { text: 'Excelente', order: 0 },
              { text: 'Bueno', order: 1 },
              { text: 'Regular', order: 2 },
              { text: 'Necesita trabajo', order: 3 },
            ],
          },
        },
        include: { options: true },
      });

      // Votes
      const excellentOption = poll.options.find((o) => o.text === 'Excelente');
      const goodOption = poll.options.find((o) => o.text === 'Bueno');
      if (excellentOption) {
        await prisma.pollVote.upsert({
          where: { pollId_userId: { pollId: poll.id, userId: readerAlex.id } },
          update: { optionId: excellentOption.id },
          create: {
            pollId: poll.id,
            optionId: excellentOption.id,
            userId: readerAlex.id,
          },
        });
      }
      if (goodOption) {
        await prisma.pollVote.upsert({
          where: {
            pollId_userId: { pollId: poll.id, userId: writerMarcos.id },
          },
          update: { optionId: goodOption.id },
          create: {
            pollId: poll.id,
            optionId: goodOption.id,
            userId: writerMarcos.id,
          },
        });
      }
    }
  }

  // ── Forum Replies ──
  let reply1 = await prisma.forumReply.findFirst({
    where: { threadId: thread1.id, authorId: writerLuna.id },
  });
  if (!reply1) {
    reply1 = await prisma.forumReply.create({
      data: {
        threadId: thread1.id,
        authorId: writerLuna.id,
        content:
          'En mi caso uso un sistema elemental con 4 pilares: fuego, agua, tierra y aire. Cada uno tiene un costo fisico diferente. La clave para mi fue definir primero las **limitaciones** — que NO puede hacer la magia. Eso le da tension a las escenas.',
        isSolution: true,
      },
    });
  }

  let reply2 = await prisma.forumReply.findFirst({
    where: { threadId: thread1.id, authorId: readerAlex.id },
  });
  if (!reply2) {
    reply2 = await prisma.forumReply.create({
      data: {
        threadId: thread1.id,
        authorId: readerAlex.id,
        content:
          'Interesante tema! Me pregunto: como manejas la consistencia del sistema cuando la trama se complica? Alguna vez tuviste que reescribir escenas porque el sistema no lo permitia?',
      },
    });
  }

  // ── Forum Reactions ──
  await prisma.forumReaction.upsert({
    where: {
      userId_threadId_reactionType: {
        userId: readerAlex.id,
        threadId: thread1.id,
        reactionType: 'HELPFUL',
      },
    },
    update: {},
    create: {
      userId: readerAlex.id,
      threadId: thread1.id,
      reactionType: 'HELPFUL',
    },
  });

  if (reply1) {
    await prisma.forumReaction.upsert({
      where: {
        userId_replyId_reactionType: {
          userId: writerMarcos.id,
          replyId: reply1.id,
          reactionType: 'LIKE',
        },
      },
      update: {},
      create: {
        userId: writerMarcos.id,
        replyId: reply1.id,
        reactionType: 'LIKE',
      },
    });
  }

  // ── Privacy Settings ──
  await prisma.privacySettings.upsert({
    where: { userId: demoWriter.id },
    update: {},
    create: { userId: demoWriter.id },
  });
  await prisma.privacySettings.upsert({
    where: { userId: readerAlex.id },
    update: { showReadingActivity: false },
    create: { userId: readerAlex.id, showReadingActivity: false },
  });

  // ── Notification Preferences ──
  await prisma.notificationPreferences.upsert({
    where: { userId: demoWriter.id },
    update: {},
    create: { userId: demoWriter.id },
  });
  await prisma.notificationPreferences.upsert({
    where: { userId: readerAlex.id },
    update: { newReactionOnPost: false },
    create: { userId: readerAlex.id, newReactionOnPost: false },
  });

  // ── Notifications demo ──
  const notifData = [
    {
      userId: demoWriter.id,
      type: 'NEW_FOLLOWER' as const,
      title: 'writer_luna te empezo a seguir',
      body: 'Tienes un nuevo seguidor',
      url: '/perfil/writer_luna',
      actorId: writerLuna.id,
      isRead: false,
    },
    {
      userId: demoWriter.id,
      type: 'NEW_CHAPTER' as const,
      title: 'Nuevo capitulo publicado',
      body: 'Capitulo 1 — El umbral',
      url: '/novelas/las-cronicas-del-velo',
      actorId: demoWriter.id,
      isRead: false,
    },
    {
      userId: demoWriter.id,
      type: 'NOVEL_MILESTONE' as const,
      title: 'Tu novela alcanzo 100 likes!',
      body: 'Las Cronicas del Velo',
      isRead: true,
    },
  ];

  for (const n of notifData) {
    const existing = await prisma.notification.findFirst({
      where: { userId: n.userId, title: n.title },
    });
    if (!existing) {
      await prisma.notification.create({ data: n as any });
    }
  }
}

async function seedAnalyticsAndMaps() {
  const demoWriter = await prisma.user.findUniqueOrThrow({
    where: { username: 'demo_writer' },
  });
  const novel = await prisma.novel.findFirst({
    where: { authorId: demoWriter.id, slug: { contains: 'cronicas' } },
  });
  if (!novel) return;

  // ── Novel Daily Snapshots (14 days) ──
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateOnly = new Date(d.toISOString().split('T')[0]);
    const dayIdx = 14 - i;
    await prisma.novelDailySnapshot.upsert({
      where: { novelId_date: { novelId: novel.id, date: dateOnly } },
      update: {},
      create: {
        novelId: novel.id,
        date: dateOnly,
        views: 5 + dayIdx * 2,
        likes: Math.min(dayIdx, 5),
        bookmarks: Math.floor(dayIdx / 3),
        newReaders: 1 + Math.floor(dayIdx * 0.3),
        chaptersRead: 3 + dayIdx,
        wordsRead: (3 + dayIdx) * 800,
      },
    });
  }

  // ── Author Daily Snapshots (14 days) ──
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateOnly = new Date(d.toISOString().split('T')[0]);
    const dayIdx = 14 - i;
    await prisma.authorDailySnapshot.upsert({
      where: { authorId_date: { authorId: demoWriter.id, date: dateOnly } },
      update: {},
      create: {
        authorId: demoWriter.id,
        date: dateOnly,
        newFollowers: Math.floor(dayIdx * 0.2),
        postReactions: 1 + dayIdx,
        profileViews: 0,
      },
    });
  }

  // ── World Map ──
  const world = await prisma.world.findFirst({
    where: { authorId: demoWriter.id, slug: 'el-mundo-del-velo' },
  });
  if (!world) return;

  const worldMap = await prisma.worldMap.upsert({
    where: { worldId: world.id },
    update: {},
    create: { worldId: world.id, canvasWidth: 2000, canvasHeight: 1500 },
  });

  // Get locations for linking
  const locations = await prisma.worldLocation.findMany({
    where: { worldId: world.id },
  });
  const echoCity = locations.find((l) => l.name.includes('Ecos'));
  const umbral = locations.find((l) => l.name.includes('Umbral'));

  const markers = [
    {
      label: 'Ciudad de los Ecos',
      type: 'CITY' as const,
      x: 0.45,
      y: 0.35,
      icon: '\u{1F3D9}\uFE0F',
      color: '#c9a84c',
      locationId: echoCity?.id ?? null,
    },
    {
      label: 'El Umbral',
      type: 'LANDMARK' as const,
      x: 0.65,
      y: 0.5,
      icon: '\u{1F300}',
      color: '#8b5cf6',
      locationId: umbral?.id ?? null,
    },
    {
      label: 'Los Campos Grises',
      type: 'RUINS' as const,
      x: 0.3,
      y: 0.6,
      icon: '\u{1F480}',
      color: '#9088a0',
      locationId: null,
    },
  ];

  for (const m of markers) {
    const existing = await prisma.mapMarker.findFirst({
      where: { mapId: worldMap.id, label: m.label },
    });
    if (!existing) {
      await prisma.mapMarker.create({
        data: {
          mapId: worldMap.id,
          label: m.label,
          type: m.type,
          x: m.x,
          y: m.y,
          icon: m.icon,
          color: m.color,
          locationId: m.locationId,
        },
      });
    }
  }

  const regions = [
    {
      label: 'Territorio de los Vivos',
      color: '#3db05a30',
      borderColor: '#3db05a',
      points: [
        { x: 0.05, y: 0.1 },
        { x: 0.55, y: 0.1 },
        { x: 0.55, y: 0.9 },
        { x: 0.05, y: 0.9 },
      ],
    },
    {
      label: 'El Velo',
      color: '#8b5cf620',
      borderColor: '#8b5cf6',
      points: [
        { x: 0.45, y: 0.0 },
        { x: 0.65, y: 0.0 },
        { x: 0.65, y: 1.0 },
        { x: 0.45, y: 1.0 },
      ],
    },
    {
      label: 'Territorio de los Muertos',
      color: '#e0555530',
      borderColor: '#e05555',
      points: [
        { x: 0.65, y: 0.1 },
        { x: 0.95, y: 0.1 },
        { x: 0.95, y: 0.9 },
        { x: 0.65, y: 0.9 },
      ],
    },
  ];

  for (const r of regions) {
    const existing = await prisma.mapRegion.findFirst({
      where: { mapId: worldMap.id, label: r.label },
    });
    if (!existing) {
      await prisma.mapRegion.create({
        data: {
          mapId: worldMap.id,
          label: r.label,
          color: r.color,
          borderColor: r.borderColor,
          points: r.points,
        },
      });
    }
  }
}

export async function main() {
  await upsertUsers();
  await seedSocialGraph();
  await seedPostsAndInteractions();
  await seedGenres();
  await seedNovels();
  await seedReaderLibrary();
  await seedWorldsAndCharacters();
  await seedWorldbuilding();
  await seedSearchHistory();
  await seedTimelineAndPlanner();
  await seedForumAndSettings();
  await seedAnalyticsAndMaps();
}
