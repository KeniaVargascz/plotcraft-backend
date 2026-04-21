import { Novel } from '@prisma/client';

export const NOVELS_SERVICE = 'NOVELS_SERVICE';

export interface INovelsService {
  findOwnedNovel(slug: string, userId: string): Promise<Novel>;
  findAccessibleNovel(slug: string, viewerId?: string | null): Promise<Novel>;
  findAccessibleNovelById(
    novelId: string,
    viewerId?: string | null,
  ): Promise<Novel>;
  recalculateNovelWordCount(novelId: string): Promise<void>;
}
