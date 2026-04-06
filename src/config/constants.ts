/**
 * Configuración centralizada de la aplicación.
 * Todos los valores que antes estaban hardcodeados en servicios individuales
 * se consolidan aquí para facilitar el mantenimiento y la configuración.
 */
export const APP_CONFIG = {
  auth: {
    saltRounds: 12,
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
    maxFailedAttempts: 5,
  },
  cache: {
    /** TTL del cache de discovery en ms (5 minutos) */
    discoveryTtl: 5 * 60 * 1000,
    /** TTL del cache de búsqueda en ms (2 minutos) */
    searchTtl: 2 * 60 * 1000,
  },
  pagination: {
    /** Límite por defecto para listados generales */
    defaultLimit: 20,
    /** Límite máximo permitido */
    maxLimit: 100,
    /** Límite para tarjetas de novelas (discovery, feed) */
    novelCardLimit: 12,
    /** Límite para listados de capítulos */
    chapterLimit: 50,
    /** Límite para notificaciones */
    notificationLimit: 20,
  },
  notifications: {
    /** Milestones de likes que disparan notificación al autor */
    milestones: [10, 50, 100, 500, 1000] as readonly number[],
  },
} as const;
