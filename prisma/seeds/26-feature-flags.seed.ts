import type { PrismaClient } from '@prisma/client';

const FLAGS = [
  // Social
  { key: 'social.feed', label: 'Feed Social', group: 'social', description: 'Feed de publicaciones y actividad social' },
  { key: 'social.feed.composer', label: 'Composer de posts', group: 'social', description: 'Crear nuevas publicaciones en el feed' },
  { key: 'social.feed.reactions', label: 'Reacciones en posts', group: 'social', description: 'Like, Love, Fire, Clap en posts' },
  { key: 'social.feed.comments', label: 'Comentarios en posts', group: 'social', description: 'Comentar publicaciones' },
  { key: 'social.follows', label: 'Sistema de follows', group: 'social', description: 'Seguir/dejar de seguir usuarios' },
  { key: 'social.notifications', label: 'Notificaciones', group: 'social', description: 'Sistema de notificaciones in-app' },

  // Explore
  { key: 'explore.discovery', label: 'Descubrir', group: 'explore', description: 'Pagina de contenido trending y destacado' },
  { key: 'explore.search', label: 'Busqueda global', group: 'explore', description: 'Buscar novelas, mundos, personajes, usuarios' },
  { key: 'explore.novels_catalog', label: 'Catalogo de novelas', group: 'explore', description: 'Explorar novelas publicas con filtros' },
  { key: 'explore.worlds_catalog', label: 'Catalogo de mundos', group: 'explore', description: 'Explorar mundos publicos' },
  { key: 'explore.characters_catalog', label: 'Catalogo de personajes', group: 'explore', description: 'Explorar personajes publicos' },
  { key: 'explore.series_catalog', label: 'Catalogo de sagas', group: 'explore', description: 'Explorar sagas y series' },

  // Author
  { key: 'author.novels', label: 'Mis Novelas', group: 'author', description: 'Crear y gestionar novelas' },
  { key: 'author.novels.chapters', label: 'Capitulos', group: 'author', description: 'Crear y editar capitulos' },
  { key: 'author.novels.scheduling', label: 'Programar publicacion', group: 'author', description: 'Programar capitulos para fecha futura' },
  { key: 'author.worlds', label: 'Mis Mundos', group: 'author', description: 'Crear y gestionar mundos' },
  { key: 'author.worlds.worldbuilding', label: 'Worldbuilding workspace', group: 'author', description: 'Categorias, entries y links de lore' },
  { key: 'author.worlds.maps', label: 'Editor de mapas', group: 'author', description: 'Crear mapas con marcadores y regiones' },
  { key: 'author.characters', label: 'Mis Personajes', group: 'author', description: 'Crear y gestionar personajes' },
  { key: 'author.characters.relationships', label: 'Relaciones de personajes', group: 'author', description: 'Kinship y relaciones entre personajes' },
  { key: 'author.series', label: 'Sagas/Series', group: 'author', description: 'Crear y gestionar sagas' },
  { key: 'author.visual_boards', label: 'Tableros visuales', group: 'author', description: 'Mood boards y referencias visuales' },
  { key: 'author.timelines', label: 'Timelines', group: 'author', description: 'Lineas de tiempo para historias' },
  { key: 'author.planner', label: 'Planner', group: 'author', description: 'Kanban de proyectos de escritura' },
  { key: 'author.planner.calendar', label: 'Calendario del planner', group: 'author', description: 'Vista de calendario de tareas' },
  { key: 'author.analytics', label: 'Analytics', group: 'author', description: 'Metricas y estadisticas de autor' },

  // Reader
  { key: 'reader.library', label: 'Biblioteca', group: 'reader', description: 'Biblioteca personal de lectura' },
  { key: 'reader.library.bookmarks', label: 'Marcadores', group: 'reader', description: 'Guardar posiciones en capitulos' },
  { key: 'reader.library.highlights', label: 'Subrayados', group: 'reader', description: 'Resaltar texto con colores' },
  { key: 'reader.library.lists', label: 'Listas de lectura', group: 'reader', description: 'Listas personalizadas de novelas' },
  { key: 'reader.library.goals', label: 'Metas de lectura', group: 'reader', description: 'Objetivos de lectura mensual/anual' },
  { key: 'reader.library.stats', label: 'Estadisticas de lectura', group: 'reader', description: 'Metricas de actividad lectora' },
  { key: 'reader.subscriptions', label: 'Suscripciones', group: 'reader', description: 'Seguir novelas para notificaciones' },
  { key: 'reader.kudos', label: 'Kudos', group: 'reader', description: 'Sistema de apreciacion (novelas, mundos, personajes)' },
  { key: 'reader.votes', label: 'Votos en capitulos', group: 'reader', description: 'Votar capitulos individuales' },

  // Community
  { key: 'community.communities', label: 'Comunidades', group: 'community', description: 'Crear y unirse a comunidades' },
  { key: 'community.communities.forums', label: 'Foros de comunidad', group: 'community', description: 'Foros internos por comunidad' },
  { key: 'community.forum', label: 'Foro global', group: 'community', description: 'Foro de discusion general' },
  { key: 'community.forum.polls', label: 'Encuestas en foro', group: 'community', description: 'Crear polls en hilos del foro' },
  { key: 'community.forum.reactions', label: 'Reacciones en foro', group: 'community', description: 'Like, Helpful, Insightful, Funny' },

  // Platform
  { key: 'platform.registration', label: 'Registro de usuarios', group: 'platform', description: 'Permitir nuevos registros' },
  { key: 'platform.media_upload', label: 'Subida de archivos', group: 'platform', description: 'Upload de imagenes (Cloudinary)' },
  { key: 'platform.content_warnings', label: 'Content warnings', group: 'platform', description: 'Sistema de advertencias de contenido' },
  { key: 'platform.templates', label: 'Plantillas', group: 'platform', description: 'Guia Markdown y plantillas de contenido' },
  { key: 'platform.data_export', label: 'Exportacion de datos', group: 'platform', description: 'Permitir a usuarios exportar sus datos' },
];

export async function seed26FeatureFlags(prisma: PrismaClient) {
  for (const flag of FLAGS) {
    await prisma.adminFeatureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: { ...flag, enabled: true },
    });
  }

  console.log(`  Seeded ${FLAGS.length} feature flags`);
}
