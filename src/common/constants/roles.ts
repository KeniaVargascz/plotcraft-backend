/**
 * Role-based access control constants.
 *
 * Roles use numeric IDs with gaps for future extensibility.
 * Higher number = more privilege. Hierarchy check: userRole >= requiredRole.
 *
 * NEVER change existing values — only append new ones.
 * Gaps allow inserting intermediate roles (e.g. MODERATOR = 30, EDITOR = 20).
 */
export const Role = {
  USER: 10,
  ADMIN: 50,
  MASTER: 100,
} as const;

export type RoleId = (typeof Role)[keyof typeof Role];

export const ROLE_LABELS: Record<number, string> = {
  [Role.USER]: 'User',
  [Role.ADMIN]: 'Admin',
  [Role.MASTER]: 'Master',
};

/** Check if userRole meets the minimum required role (hierarchy-aware). */
export function hasRole(userRole: number, minRole: RoleId): boolean {
  return userRole >= minRole;
}
