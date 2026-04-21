import { World } from '@prisma/client';

export const WORLDS_SERVICE = 'WORLDS_SERVICE';

export interface IWorldsService {
  findOwnedWorld(userId: string, slug: string): Promise<World>;
  getWorldEntity(slug: string, viewerId?: string | null): Promise<World>;
}
