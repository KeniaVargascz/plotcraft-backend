import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_SERVICE, QueueService } from '../../common/queue/queue.interface';
import { CACHE_SERVICE, CacheService } from '../../common/services/cache.service';

export const NOTIFICATION_QUEUE = 'notifications:bulk';

export type BulkNotificationJob = {
  recipients: string[];
  type: string;
  title: string;
  body: string;
  url: string | null;
  actorId: string;
};

/**
 * Processes bulk notification jobs from the queue (S — Single Responsibility).
 * Runs a polling loop that batches inserts and invalidates unread caches.
 */
@Injectable()
export class NotificationQueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueProcessor.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_SERVICE) private readonly queue: QueueService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.processQueue(), 3000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      const jobs = await this.queue.dequeue<BulkNotificationJob>(
        NOTIFICATION_QUEUE,
        5,
      );

      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (err) {
      this.logger.error(`Queue processing error: ${(err as Error).message}`);
    } finally {
      this.processing = false;
    }
  }

  private async processJob(job: BulkNotificationJob) {
    const { recipients, type, title, body, url, actorId } = job;

    if (!recipients.length) return;

    // Batch insert in chunks of 500 to avoid oversized queries
    const CHUNK_SIZE = 500;
    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);
      await this.prisma.notification.createMany({
        data: chunk.map((userId) => ({
          userId,
          type: type as any,
          title,
          body,
          url,
          actorId,
        })),
        skipDuplicates: true,
      });
    }

    // Invalidate unread count cache for all recipients
    const invalidations = recipients.map((userId) =>
      this.cache.del(`unread:${userId}`),
    );
    await Promise.all(invalidations);

    this.logger.log(
      `Processed ${recipients.length} notifications (type: ${type})`,
    );
  }
}
