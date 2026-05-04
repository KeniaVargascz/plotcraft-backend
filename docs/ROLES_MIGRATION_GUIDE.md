# Guía de Migración a Roles Granulares

## Sistema Actual

```
Role.USER   = 10   → Usuario normal
Role.ADMIN  = 50   → Revisa comunidades en app de usuario
Role.MASTER = 100  → Acceso completo al admin panel + 2FA obligatorio
```

**Jerarquía:** `MASTER(100) > ADMIN(50) > USER(10)`. Check: `userRole >= requiredRole`.

**Archivo de constantes:** `src/common/constants/roles.ts`

---

## Cómo agregar un nuevo rol

### Paso 1: Definir la constante

```typescript
// src/common/constants/roles.ts
export const Role = {
  USER: 10,
  EDITOR: 20,       // NUEVO
  MODERATOR: 30,    // NUEVO
  ADMIN: 50,
  MASTER: 100,
} as const;
```

Los gaps numéricos (10→50→100) permiten insertar roles sin renumerar.

### Paso 2: Agregar label

```typescript
export const ROLE_LABELS: Record<number, string> = {
  [Role.USER]: 'User',
  [Role.EDITOR]: 'Editor',
  [Role.MODERATOR]: 'Moderator',
  [Role.ADMIN]: 'Admin',
  [Role.MASTER]: 'Master',
};
```

### Paso 3: Usar en controllers

```typescript
// Solo MODERATOR o superior puede moderar foro
@MinRole(Role.MODERATOR)
@Post('forum/:id/lock')
lockThread() { ... }

// Solo EDITOR o superior puede editar contenido
@MinRole(Role.EDITOR)
@Patch('novels/:id/feature')
featureNovel() { ... }
```

### Paso 4: Actualizar el admin panel

En `admin-users.service.ts`, el endpoint `updateRole` ya valida contra `Object.values(Role)`. Los nuevos roles se aceptan automáticamente.

**No se necesita migración de DB** — el campo `role` es `Int`, cualquier valor es válido.

---

## Migración a permisos granulares (si se necesita en el futuro)

Si los roles jerárquicos no son suficientes (ej: rol A puede hacer X pero no Y, rol B puede hacer Y pero no X), migrar a un sistema de permisos:

### Opción A: Bitmask (recomendado para <32 permisos)

```typescript
export const Permission = {
  READ:           1 << 0,   // 1
  WRITE:          1 << 1,   // 2
  MODERATE_FORUM: 1 << 2,   // 4
  REVIEW_CONTENT: 1 << 3,   // 8
  MANAGE_USERS:   1 << 4,   // 16
  MANAGE_FLAGS:   1 << 5,   // 32
  MANAGE_SETTINGS:1 << 6,   // 64
  FULL_ACCESS:    0x7FFFFFFF,
} as const;

// Role presets
export const ROLE_PERMISSIONS = {
  [Role.USER]:      Permission.READ | Permission.WRITE,
  [Role.MODERATOR]: Permission.READ | Permission.WRITE | Permission.MODERATE_FORUM,
  [Role.ADMIN]:     Permission.READ | Permission.WRITE | Permission.REVIEW_CONTENT,
  [Role.MASTER]:    Permission.FULL_ACCESS,
};

// Check
function hasPermission(userPerms: number, required: number): boolean {
  return (userPerms & required) === required;
}
```

**Ventaja:** Extremadamente rápido (operación bitwise). Una columna `Int`.
**Desventaja:** Máximo 31 permisos (Int32). No autodocumentado.

### Opción B: Tabla de permisos (recomendado para >32 permisos)

```sql
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,  -- 'forum.moderate', 'users.manage'
  description TEXT
);

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);
```

```typescript
// Guard
@RequirePermission('forum.moderate')
@Post('forum/:id/lock')
lockThread() { ... }
```

**Ventaja:** Ilimitados permisos. Autodocumentado. Administrable desde UI.
**Desventaja:** JOIN en cada request. Necesita cache agresivo.

### Opción C: Mantener roles jerárquicos + excepciones

La opción más pragmática: mantener `role: Int` para jerarquía general, y agregar un campo `permissions: Int` (bitmask) para excepciones.

```typescript
// El rol da permisos base, el bitmask agrega/quita
function canDo(user: User, permission: number): boolean {
  const basePerms = ROLE_PERMISSIONS[user.role] ?? 0;
  return hasPermission(basePerms | user.permissions, permission);
}
```

**Ventaja:** No rompe el sistema actual. Gradual.
**Desventaja:** Dos sistemas coexisten.

---

## Checklist de migración

### Al agregar un rol nuevo:
- [ ] Agregar constante en `roles.ts` con gap numérico apropiado
- [ ] Agregar label en `ROLE_LABELS`
- [ ] Verificar que `Object.values(Role)` en `updateRole` lo acepta
- [ ] Agregar `@MinRole()` donde aplique
- [ ] Actualizar frontend si hay UI condicional
- [ ] Documentar en este archivo

### Al migrar de roles a permisos:
- [ ] Crear tabla `permissions` + `role_permissions`
- [ ] Crear `PermissionsGuard` que reemplace `RolesGuard`
- [ ] Crear decorator `@RequirePermission('key')`
- [ ] Migrar `@MinRole()` → `@RequirePermission()` gradualmente
- [ ] Agregar cache de permisos en `UserStatusCacheService`
- [ ] Mantener `role` como campo legacy (no eliminar)
- [ ] Actualizar admin panel para gestionar permisos por rol

### Al eliminar `isAdmin`:
- [ ] Verificar que ningún código usa `isAdmin` (grep completo)
- [ ] Aplicar migración `FUTURE_drop_is_admin`
- [ ] Eliminar `isAdmin` del schema de Prisma
- [ ] Eliminar `isAdmin` del `JwtPayload`
- [ ] Eliminar `isAdmin` de `UserEntity`
- [ ] Eliminar `isAdmin` de `UserStatus` cache
- [ ] Eliminar `isAdmin` de interfaces frontend/admin
- [ ] Deploy coordinado de los 3 proyectos

---

## Arquitectura actual de verificación

```
Request
  │
  ├── JwtStrategy.validate()
  │     ├── payload.role disponible en request.user
  │     └── Skip FLAGS_CHANGED si role >= MASTER
  │
  ├── AdminGuard (en controllers de admin panel)
  │     ├── JWT check: hasRole(user.role, Role.MASTER)
  │     └── DB check: hasRole(cache.role, Role.MASTER)
  │
  ├── RolesGuard (nuevo, para uso con @MinRole)
  │     ├── Lee @MinRole metadata
  │     ├── JWT check: hasRole(user.role, minRole)
  │     └── DB check: hasRole(cache.role, minRole)
  │
  └── Frontend
        ├── adminMatchGuard: user.role >= 50
        └── authService.isAdmin(): role >= 50
```
