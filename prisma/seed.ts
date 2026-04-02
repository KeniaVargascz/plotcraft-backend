import {
  ChapterStatus,
  NovelRating,
  NovelStatus,
  PostType,
  Prisma,
  PrismaClient,
  ReactionType,
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
      bio: 'Cuenta principal de demostracion para probar el flujo de PlotCraft.',
      website: 'https://plotcraft.local/demo-writer',
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
    },
  },
  {
    email: 'reader.alex@plotcraft.com',
    username: 'reader_alex',
    profile: {
      displayName: 'Reader Alex',
      bio: 'Lector beta, comentarista y coleccionista de historias largas.',
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
  ['fantasy', 'Fantasy'],
  ['sci-fi', 'Sci-Fi'],
  ['romance', 'Romance'],
  ['mystery', 'Mystery'],
  ['horror', 'Horror'],
  ['thriller', 'Thriller'],
  ['adventure', 'Adventure'],
  ['historical', 'Historical'],
  ['literary-fiction', 'Literary Fiction'],
  ['young-adult', 'Young Adult'],
  ['fanfiction', 'Fanfiction'],
  ['poetry', 'Poetry'],
  ['slice-of-life', 'Slice of Life'],
  ['dystopia', 'Dystopia'],
  ['mythology', 'Mythology'],
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
        isPublic: true,
      },
      create: {
        userId: user.id,
        displayName: entry.profile.displayName,
        bio: entry.profile.bio,
        website: entry.profile.website,
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

    await prisma.chapter.upsert({
      where: {
        novelId_slug: {
          novelId: novel.id,
          slug: chapterSlug,
        },
      },
      update: {
        authorId: author.id,
        title: entry.title,
        content: entry.content,
        order: entry.order,
        status: entry.status,
        wordCount,
        publishedAt,
        scheduledAt: null,
        contentSnapshot,
      },
      create: {
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
      'Una cartografa descubre que el mapa de su ciudad encubre un corredor hacia un reino anfibio donde toda deuda se paga con memoria.',
    status: NovelStatus.IN_PROGRESS,
    rating: NovelRating.PG13,
    genreSlugs: ['fantasy', 'mythology'],
    tags: ['serial', 'magia', 'ciudad-puerto'],
    isPublic: true,
    viewsCount: 42,
    chapters: veilChapters,
  });

  const silence = await upsertNovelWithChapters({
    authorUsername: 'writer_luna',
    title: 'El Septimo Silencio',
    synopsis:
      'Una desaparicion imposible obliga a una inspectora a reconstruir una noche de versiones contradictorias y omisiones peligrosas.',
    status: NovelStatus.COMPLETED,
    rating: NovelRating.R,
    genreSlugs: ['mystery', 'thriller'],
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

async function main() {
  await upsertUsers();
  await seedSocialGraph();
  await seedPostsAndInteractions();
  await seedGenres();
  await seedNovels();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
