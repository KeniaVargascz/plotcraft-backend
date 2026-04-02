import { PostType, PrismaClient, ReactionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
] as const;

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

  const postsByContent = new Map<string, { id: string; authorId: string }>();

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

    postsByContent.set(entry.content, { id: post.id, authorId: author.id });
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

async function main() {
  await upsertUsers();
  await seedSocialGraph();
  await seedPostsAndInteractions();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
