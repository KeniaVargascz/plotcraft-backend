# PlotCraft Backend

API backend de PlotCraft para autenticacion, usuarios y perfiles.

## Stack

- NestJS
- Prisma
- PostgreSQL
- JWT access + refresh token
- Swagger

## Requisitos

- Node.js LTS
- pnpm
- PostgreSQL local

## Configuracion

1. Copia `.env.example` a `.env`
2. Ajusta `DATABASE_URL`
3. Instala dependencias:

```bash
pnpm install
```

## Base de datos

```bash
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm prisma:seed
```

## Cambio reciente de rating

- El enum `NovelRating` usa `T` en lugar de `PG13`.
- La migracion correspondiente vive en `prisma/migrations/20260408050000_rename_rating_pg13_to_t/`.
- Si una base local ya fue ajustada manualmente y Prisma no registro la migracion, sincroniza el historial con:

```bash
pnpm exec prisma migrate resolve --applied 20260408050000_rename_rating_pg13_to_t
```

## Desarrollo

```bash
pnpm start:dev
```

API:
- `http://localhost:3000`

Swagger:
- `http://localhost:3000/api/docs`

## Credenciales demo

- `demo@plotcraft.com`
- `Demo1234!`
