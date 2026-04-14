import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { runSeedStep } from './seed-step.util';
import { SEED_IDS } from './constants/seed-ids.const';

/**
 * Generates bulk data across all modules to validate pagination.
 * Creates ~30-50 records per entity type so paginated pages are visible.
 */
export async function seed25PaginationTestData(
  prisma: PrismaClient,
): Promise<void> {
  await runSeedStep(prisma, 'pagination-test-data', async () => {
    const hash = await bcrypt.hash('Demo1234!', 12);
    const demoId = SEED_IDS.users.demo_writer;
    const lunaId = SEED_IDS.users.writer_luna;
    const marcosId = SEED_IDS.users.writer_marcos;

    // ── Ensure demo users exist ──
    const userDefs = [
      { id: demoId, email: 'demo@plotcraft.com', username: 'demo_writer' },
      { id: lunaId, email: 'luna@plotcraft.com', username: 'writer_luna' },
      { id: marcosId, email: 'writer.marcos@plotcraft.com', username: 'writer_marcos' },
      { id: SEED_IDS.users.reader_alex, email: 'reader.alex@plotcraft.com', username: 'reader_alex' },
    ];

    const resolvedAuthors: string[] = [];
    for (const u of userDefs) {
      let user = await prisma.user.findFirst({ where: { OR: [{ id: u.id }, { email: u.email }] } });
      if (!user) {
        user = await prisma.user.create({
          data: { id: u.id, email: u.email, username: u.username, passwordHash: hash, status: 'ACTIVE' },
        });
      }
      const existing = await prisma.profile.findUnique({ where: { userId: user.id } });
      if (!existing) {
        await prisma.profile.create({ data: { userId: user.id, displayName: u.username.replace('_', ' ') } });
      }
      resolvedAuthors.push(user.id);
    }

    // ── Get a language id ──
    const lang = await prisma.catalogLanguage.findFirst({ where: { code: 'es' } });
    if (!lang) throw new Error('Run language seed first');

    const genres = await prisma.genre.findMany({ take: 10 });
    if (!genres.length) throw new Error('Run genre seed first');

    const authors = resolvedAuthors.slice(0, 3);
    let counter = 0;
    const slug = (prefix: string) => `${prefix}-${++counter}-${Date.now().toString(36)}`;

    // ── 40 Novels ──
    const novelTitles = [
      'El Despertar del Dragón', 'Sombras en la Niebla', 'Crónicas de Aether',
      'El Último Hechicero', 'Mar de Estrellas', 'La Torre Infinita',
      'Reinos Olvidados', 'El Jardín de Cristal', 'Vientos de Guerra',
      'La Espada del Destino', 'Susurros del Abismo', 'El Trono de Hielo',
      'Laberintos de Luz', 'La Dama de las Sombras', 'Cenizas del Imperio',
      'El Bosque Encantado', 'Ríos de Sangre', 'La Profecía Perdida',
      'Corazones de Acero', 'El Mapa del Tiempo', 'La Isla Prohibida',
      'Ecos del Pasado', 'El Reloj de Arena', 'Noche Eterna',
      'El Faro del Fin del Mundo', 'Corona de Espinas', 'Almas Errantes',
      'El Secreto del Alquimista', 'Puentes de Plata', 'El Valle Oscuro',
      'Legado de Fuego', 'La Canción del Mar', 'Tierra de Nadie',
      'El Cazador de Sueños', 'Rosas y Veneno', 'El Pacto del Lobo',
      'Prisma de Realidades', 'La Puerta Olvidada', 'Estrellas Rotas',
      'El Veredicto Final',
    ];

    const novelIds: string[] = [];
    const statuses = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'HIATUS'] as const;
    const ratings = ['G', 'PG', 'T', 'R'] as const;

    for (let i = 0; i < novelTitles.length; i++) {
      const title = novelTitles[i];
      const s = slug('novel');
      const novel = await prisma.novel.create({
        data: {
          authorId: authors[i % authors.length],
          languageId: lang.id,
          title,
          slug: s,
          synopsis: `Sinopsis de "${title}". Una historia fascinante que te llevará a mundos desconocidos llenos de aventura y misterio.`,
          status: statuses[i % statuses.length],
          rating: ratings[i % ratings.length],
          isPublic: true,
          wordCount: Math.floor(Math.random() * 80000) + 5000,
          viewsCount: Math.floor(Math.random() * 500),
        },
      });
      novelIds.push(novel.id);

      // Link 1-2 genres per novel
      const genreCount = (i % 2) + 1;
      for (let g = 0; g < genreCount; g++) {
        const genre = genres[(i + g) % genres.length];
        await prisma.novelGenre.upsert({
          where: { novelId_genreId: { novelId: novel.id, genreId: genre.id } },
          update: {},
          create: { novelId: novel.id, genreId: genre.id },
        });
      }
    }
    console.log(`    → ${novelTitles.length} novelas creadas`);

    // ── 40 Worlds ──
    const worldNames = [
      'Aetherya', 'Valdris', 'Nocturia', 'Solheim', 'Crystalia',
      'Umbracrest', 'Pyrothan', 'Lunaris', 'Tempestia', 'Verdantis',
      'Glacium', 'Infernia', 'Aqualon', 'Caelum', 'Terranova',
      'Nebulon', 'Mythrandil', 'Obsidiana', 'Starfall', 'Voidreach',
      'Brighthollow', 'Grimwood', 'Silverdeep', 'Ironpeak', 'Stormrift',
      'Ashenvale', 'Frostmere', 'Sunspire', 'Thornwall', 'Duskmeadow',
      'Goldmist', 'Shadowfen', 'Coralheim', 'Blightmoor', 'Windhaven',
      'Ravencrest', 'Moonvale', 'Fireholm', 'Stonegrasp', 'Tidecrest',
    ];

    const worldIds: string[] = [];
    for (let i = 0; i < worldNames.length; i++) {
      const name = worldNames[i];
      const world = await prisma.world.create({
        data: {
          authorId: authors[i % authors.length],
          name,
          slug: slug('world'),
          tagline: `El mundo de ${name} — un reino de maravillas y peligros.`,
          description: `${name} es un mundo vasto con una historia milenaria, criaturas místicas y civilizaciones antiguas.`,
          visibility: 'PUBLIC',
        },
      });
      worldIds.push(world.id);
    }
    console.log(`    → ${worldNames.length} mundos creados`);

    // ── 50 Characters ──
    const charNames = [
      'Kael', 'Lyra', 'Seren', 'Theron', 'Aelith', 'Draven', 'Nira',
      'Orin', 'Vex', 'Mira', 'Cael', 'Rowan', 'Ilya', 'Dain', 'Freya',
      'Zephyr', 'Nyx', 'Aria', 'Kira', 'Ezra', 'Sage', 'Rune', 'Ember',
      'Frost', 'Storm', 'Blaze', 'Dawn', 'Shade', 'Hawk', 'Wren',
      'Asher', 'Luna', 'Felix', 'Nova', 'Ivy', 'Rex', 'Jade', 'Onyx',
      'Coral', 'Flint', 'Briar', 'Vale', 'Lark', 'Finn', 'Iris',
      'Gale', 'Mica', 'Rue', 'Sol', 'Elm',
    ];

    const roles = ['PROTAGONIST', 'ANTAGONIST', 'SECONDARY', 'MENTOR', 'ALLY', 'RIVAL', 'NEUTRAL', 'BACKGROUND'] as const;
    const charStatuses = ['ALIVE', 'DECEASED', 'UNKNOWN'] as const;

    const characterIds: string[] = [];
    for (let i = 0; i < charNames.length; i++) {
      const name = charNames[i];
      const char = await prisma.character.create({
        data: {
          authorId: authors[i % authors.length],
          name,
          slug: slug('char'),
          role: roles[i % roles.length],
          status: charStatuses[i % charStatuses.length],
          personality: `${name} es un personaje complejo con motivaciones profundas.`,
          backstory: `## Origen\n\n${name} nació en tierras lejanas y su destino cambió cuando descubrió su verdadero poder.`,
          isPublic: true,
          worldId: worldIds[i % worldIds.length],
        },
      });
      characterIds.push(char.id);
    }
    console.log(`    → ${charNames.length} personajes creados`);

    // ── 30 Communities ──
    const communityNames = [
      'Escritores de Fantasía', 'Club de Ciencia Ficción', 'Romance Literario',
      'Terror Nocturno', 'Misterio y Suspense', 'Aventureros Épicos',
      'Drama Contemporáneo', 'Thriller Psicológico', 'Historia Viva',
      'Comedia Creativa', 'Distopía y Utopía', 'Paranormal Activity',
      'Slice of Life Club', 'Acción Sin Límites', 'Poetas del Alma',
      'Fanfic Universe', 'Worldbuilders', 'Character Designers',
      'Beta Readers', 'NaNoWriMo LATAM', 'Escribiendo Juntos',
      'Críticos Constructivos', 'Ilustradores Narrativos', 'Editores Independientes',
      'Novelistas Novatos', 'Autores Publicados', 'Fantasía Oscura',
      'Sci-Fi Hard', 'Cuentos Cortos', 'Microrrelatos',
    ];

    const communityTypes = ['PUBLIC', 'PRIVATE', 'FANDOM'] as const;
    for (let i = 0; i < communityNames.length; i++) {
      const name = communityNames[i];
      await prisma.community.create({
        data: {
          ownerId: authors[i % authors.length],
          type: communityTypes[i % communityTypes.length],
          name,
          slug: slug('community'),
          description: `Comunidad dedicada a ${name.toLowerCase()}. Únete para compartir y crecer como escritor.`,
          status: 'ACTIVE',
        },
      });
    }
    console.log(`    → ${communityNames.length} comunidades creadas`);

    // ── 25 Series ──
    const seriesNames = [
      'Crónicas del Velo', 'Trilogía de las Sombras', 'Saga de Aether',
      'Dilema del Hechicero', 'Las Estrellas Perdidas', 'Serie Infinita',
      'Reinos en Guerra', 'Cristales de Poder', 'El Ciclo del Viento',
      'Espadas del Destino', 'Susurros Ancestrales', 'La Era del Hielo',
      'Laberintos Dorados', 'Sombras y Damas', 'Imperios Caídos',
      'Bosques Malditos', 'Ríos Carmesí', 'Profecías Antiguas',
      'Corazones Blindados', 'Crononautas', 'Islas del Olvido',
      'Ecos Inmortales', 'Arenas del Tiempo', 'Noches Sin Fin',
      'Faros Extintos',
    ];

    const seriesTypes = ['SAGA', 'TRILOGY', 'DILOGY', 'SERIES'] as const;
    const seriesStatuses = ['IN_PROGRESS', 'COMPLETED', 'HIATUS'] as const;
    for (let i = 0; i < seriesNames.length; i++) {
      const title = seriesNames[i];
      const series = await prisma.series.create({
        data: {
          authorId: authors[i % authors.length],
          title,
          slug: slug('series'),
          description: `${title} — una colección épica de historias entrelazadas.`,
          type: seriesTypes[i % seriesTypes.length],
          status: seriesStatuses[i % seriesStatuses.length],
        },
      });

      // Link 1-2 novels to each series
      const novelCount = (i % 2) + 1;
      for (let n = 0; n < novelCount; n++) {
        const novelId = novelIds[(i * 2 + n) % novelIds.length];
        await prisma.seriesNovel.upsert({
          where: { seriesId_novelId: { seriesId: series.id, novelId } },
          update: {},
          create: { seriesId: series.id, novelId, orderIndex: n },
        });
      }
    }
    console.log(`    → ${seriesNames.length} series creadas`);

    // ── 30 Forum Threads ──
    const forumCategories = [
      'GENERAL', 'FEEDBACK', 'WRITING_TIPS', 'WORLD_BUILDING',
      'CHARACTERS', 'SHOWCASE', 'ANNOUNCEMENTS', 'HELP', 'OFF_TOPIC',
    ] as const;

    const threadTitles = [
      '¿Cómo crear un sistema de magia coherente?',
      'Tips para escribir diálogos naturales',
      'Mi primera novela — pido feedback',
      'Worldbuilding: ¿por dónde empezar?',
      'Personajes femeninos fuertes sin estereotipos',
      '¿Cómo mantener la consistencia en series largas?',
      'Recursos gratuitos para escritores',
      'Comparte tu proyecto actual',
      'El arte de los giros argumentales',
      'Música para escribir — recomendaciones',
      '¿Plotter o pantser?',
      'Errores comunes en fantasía épica',
      'Técnicas de descripción sensorial',
      'POV múltiples: ¿sí o no?',
      'Mi experiencia autopublicando',
      '¿Cómo superar el bloqueo creativo?',
      'Crear idiomas ficticios para tu mundo',
      'Beta readers: ¿dónde encontrarlos?',
      'La importancia del arco del personaje',
      'Escribir villanos memorables',
      'Ritmo narrativo en novelas de acción',
      'Foreshadowing sin ser obvio',
      '¿Cuántas palabras por día escribes?',
      'Herramientas digitales para escritores',
      'Construir tensión romántica sin clichés',
      'Feedback de mi capítulo 1',
      'Mapas para tu mundo fantástico',
      'La regla de las tres escenas',
      'Nombres para personajes de fantasía',
      'Show, don\'t tell — ejemplos prácticos',
    ];

    for (let i = 0; i < threadTitles.length; i++) {
      const title = threadTitles[i];
      await prisma.forumThread.create({
        data: {
          authorId: authors[i % authors.length],
          category: forumCategories[i % forumCategories.length],
          title,
          slug: slug('thread'),
          content: `## ${title}\n\nEste es un hilo de discusión sobre "${title.toLowerCase()}". Comparte tu experiencia y opiniones sobre este tema.\n\n¿Qué piensan ustedes?`,
          status: 'OPEN',
        },
      });
    }
    console.log(`    → ${threadTitles.length} hilos de foro creados`);

    console.log('    → Seed de datos de paginación completado');
  });
}
