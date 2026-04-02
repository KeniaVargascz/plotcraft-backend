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
