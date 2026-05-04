import { SetMetadata } from '@nestjs/common';
import type { RoleId } from '../constants/roles';

export const MIN_ROLE_KEY = 'minRole';
export const MinRole = (role: RoleId) => SetMetadata(MIN_ROLE_KEY, role);
