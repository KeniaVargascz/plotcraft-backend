# PlotCraft Backend — Guia de Desarrollo

## Stack

- **Runtime:** Node.js 24 + NestJS + TypeScript (strict, noImplicitAny)
- **ORM:** Prisma con PostgreSQL (Neon serverless + PgBouncer pooler)
- **Cache:** Redis via ioredis (Upstash serverless)
- **Auth:** JWT (access 60min + refresh 7d) con bcrypt, family rotation, account lockout
- **Seguridad:** Helmet, @nestjs/throttler, timing-safe login
- **Deploy:** Render (auto-deploy on push to main)
- **API prefix:** `/api/v1/` (todas las rutas)

## Convenciones obligatorias

### Respuestas API

- **Todos los campos en camelCase** — nunca snake_case en responses
- **Wrapper global:** `{ success: true, data: T, timestamp: string }` via TransformInterceptor
- **Errores:** `{ success: false, error: { statusCode, message, code?, errors?[] }, timestamp }`
- **Paginacion cursor:** `{ data: T[], pagination: { nextCursor, hasMore, limit } }`
- **Paginacion page:** `{ data: T[], pagination: { page, limit, total, totalPages, hasMore } }`
- **Nunca mezclar:** no incluir `page: null` en cursor ni `nextCursor: null` en page

### Cache Headers

- Endpoints `@Public()` GET: `Cache-Control: public, max-age=60` (default)
- Catalogos (`@CacheTtl(86400)`): genres, languages, warnings, romance-genres, wb/templates
- Discovery (`@CacheTtl(300)`): todos los endpoints del controller
- Endpoints privados: `Cache-Control: private, no-store` (automatico via interceptor)
- POST/PATCH/DELETE: `Cache-Control: no-store`

### Servicios

- **Maximo 500 lineas por servicio.** Si crece mas, splitear en sub-servicios
- **Un servicio = una responsabilidad.** CRUD separado de validacion, interacciones separadas de core
- **Sub-servicios** van en carpeta `services/` dentro del modulo: `modules/novels/services/novel-interactions.service.ts`
- **Inyeccion cross-module via interface token:** usar `@Inject(NOVELS_SERVICE)` con `INovelsService`, no la clase concreta
- **Interfaces existentes:** `INotificationsService`, `INovelsService`, `IWorldsService`, `IUsersService`, `IAuthService`
- **Para crear nueva interface:** exportar token + interface en `modulo.interface.ts`, agregar `{ provide: TOKEN, useExisting: ConcreteService }` en el module

### Base de datos

- **Nunca `findMany()` sin select/include** — siempre proyeccion explicita
- **Maximo 2 niveles de include.** Si necesitas mas, queries separadas
- **Indices:** todo query frecuente debe tener indice. Usar partial indexes donde aplique
- **Migraciones manuales** (shadow DB de Prisma falla con PgBouncer). Crear en `prisma/migrations/YYYYMMDDHHMMSS_nombre/migration.sql`
- **`$queryRawUnsafe` NO funciona con PgBouncer** (params posicionales $1,$2). Usar `$queryRaw` tagged templates o Prisma queries
- **Slug generation:** usar `generateUniqueSlug()` de `common/utils/unique-slug.util.ts` — O(1) con una sola query

### Redis Cache

- **CacheService interface** (`common/services/cache.service.ts`): `get/set/del/invalidatePattern`
- **Inyectar via `@Inject(CACHE_SERVICE)`** — nunca inyectar MemoryCacheService o RedisCacheService directo
- **TTLs estandar:** discovery 5min, search 2min, catalogos 24h, unread count 30s
- **Invalidar cache** cuando los datos subyacentes cambian (ej: `invalidateUnreadCount` al crear notificacion)

### Queue

- **QueueService interface** (`common/queue/queue.interface.ts`): `enqueue/dequeue/length`
- **Inyectar via `@Inject(QUEUE_SERVICE)`**
- **Notificaciones masivas** (>10 destinatarios): siempre encolar, nunca insertar sincrono
- **El processor** (`notification-queue.processor.ts`) procesa en chunks de 500 cada 3s

### Media / Cloudinary

- **CloudinaryService** sube a cloud cuando `CLOUDINARY_CLOUD_NAME` esta configurado
- **Fallback a filesystem local** si no hay credenciales (solo desarrollo)
- **Response de upload incluye:** url, publicId, width, height, format, size
- **Para resize:** usar `cloudinaryService.imageUrl(publicId, { width, height, crop })`

### Seguridad

- **Rate limiting:** auth endpoints tienen `@Throttle({ short: { limit: 5, ttl: 60000 } })`
- **Forgot-password:** limite mas estricto `{ limit: 3, ttl: 60000 }`
- **Account lockout:** 5 intentos fallidos = bloqueo 15 min
- **Timing-safe:** siempre hacer `bcrypt.compare` contra dummy hash si usuario no existe
- **Nunca loggear:** tokens, hashes, passwords, ni parcialmente
- **Mensajes de error auth:** siempre genericos ("Credenciales incorrectas"), nunca revelar si email existe

### Testing

- **Patron AAA:** Arrange / Act / Assert
- **Un `describe` por clase, un `it` por comportamiento**
- **Mock del cache:** `{ get: async () => null, set: async () => {}, del: async () => {}, invalidatePattern: async () => {} }`
- **Mock del queue:** `{ enqueue: async () => {}, dequeue: async () => [], length: async () => 0 }`
- **Integration tests** usan `/api/v1/` prefix

### Commits

- **Formato:** `tipo(scope): descripcion`
- **Tipos:** feat, fix, refactor, perf, chore, docs
- **No push sin verificar:** `npx tsc --noEmit` debe pasar sin errores
- **Co-author:** incluir `Co-Authored-By` si aplica

## Estructura de carpetas

```
src/
├── common/
│   ├── cache.module.ts          # Global, auto-selecciona Redis o Memory
│   ├── decorators/              # @Public(), @CacheTtl()
│   ├── filters/                 # HttpExceptionFilter (global)
│   ├── guards/                  # JwtAuthGuard (global)
│   ├── interceptors/            # TransformInterceptor, CacheHeadersInterceptor
│   ├── pipes/                   # ValidationPipe (global)
│   ├── queue/                   # QueueModule, QueueService interface, RedisQueueService
│   ├── repository/              # BaseRepository interface, 5 implementations
│   ├── services/                # CacheService interface, MemoryCache, RedisCache
│   └── utils/                   # unique-slug.util.ts
├── config/
│   └── constants.ts             # APP_CONFIG centralizado
├── modules/
│   └── [modulo]/
│       ├── [modulo].controller.ts
│       ├── [modulo].service.ts
│       ├── [modulo].module.ts
│       ├── [modulo].interface.ts  # Interface + token para cross-module DI
│       ├── dto/                   # Input DTOs
│       ├── services/              # Sub-servicios (si el modulo fue splitteado)
│       └── utils/                 # Utilidades especificas del modulo
└── prisma/
    ├── schema.prisma
    └── migrations/
```

## Checklist para nuevo endpoint

1. DTO con validacion en `dto/`
2. Metodo en el servicio correspondiente (o sub-servicio si >500 lineas)
3. Ruta en el controller con `@ApiOperation`, `@ApiTags`
4. `@Public()` si es publico, nada si requiere auth
5. `@CacheTtl(seconds)` si necesita TTL custom
6. Response en camelCase con pagination estandarizada
7. `npx tsc --noEmit` pasa
8. Test (cuando la cobertura lo requiera)

## Checklist para nueva migracion

1. Crear carpeta: `prisma/migrations/YYYYMMDDHHMMSS_nombre/migration.sql`
2. SQL idempotente: `IF NOT EXISTS`, `CREATE OR REPLACE`
3. No usar `CONCURRENTLY` (incompatible con PgBouncer)
4. Ejecutar: `npx prisma migrate deploy` (en Render se ejecuta en start command)
5. Regenerar client: `npx prisma generate`
