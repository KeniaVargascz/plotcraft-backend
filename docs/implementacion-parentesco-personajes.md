# Implementacion de parentesco entre personajes

## Resumen

Se agrego soporte estructurado para relaciones de parentesco entre personajes reutilizando el modelo existente de relaciones.

La implementacion cubre:

- tipado de parentesco en base de datos
- creacion automatica de la relacion inversa
- eliminacion por grupo de relacion
- respuesta enriquecida para frontend
- pruebas de integracion del flujo principal

## Cambios tecnicos

### Base de datos

Se extendio `CharacterRelationship` para soportar parentesco de forma explicita:

- `category`
- `kinshipType`
- `relationshipGroupId`

Tambien se agregaron enums Prisma para:

- `CharacterRelationshipCategory`
- `CharacterKinshipType`

La migracion asociada esta en:

- `prisma/migrations/20260409220000_add_character_kinship_relationships/migration.sql`

### API y servicio

Se actualizo el DTO de creacion para aceptar parentesco estructurado y se mantuvo compatibilidad con el flujo previo basado en `type`.

En `CharactersService` se incorporo logica para:

- validar que el personaje no se relacione consigo mismo
- resolver el tipo inverso de parentesco
- crear las dos filas de una relacion logica usando `relationshipGroupId`
- evitar duplicados semanticos
- eliminar la relacion y su inversa en una sola operacion
- exponer `label`, `category`, `kinshipType` y `relationshipGroupId` en la respuesta

### Pruebas

Se agrego un test de integracion para validar:

- alta de parentesco con inversa automatica
- borrado por grupo
- rechazo de self-link

Archivo:

- `src/__tests__/integration/characters-relationships.integration.spec.ts`

## Tipos de parentesco soportados

- `PARENT`
- `CHILD`
- `SIBLING`
- `GRANDPARENT`
- `GRANDCHILD`
- `UNCLE_AUNT`
- `NIECE_NEPHEW`
- `COUSIN`
- `SPOUSE`
- `STEP_PARENT`
- `STEP_CHILD`
- `GUARDIAN`
- `WARD`

## Verificacion realizada

Se valido localmente con:

```powershell
pnpm.cmd exec prisma migrate deploy
pnpm.cmd exec prisma generate
pnpm.cmd build
pnpm.cmd test:integration -- --runTestsByPath src/__tests__/integration/characters-relationships.integration.spec.ts
```
