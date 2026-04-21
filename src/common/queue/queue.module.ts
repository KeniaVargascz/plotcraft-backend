import { Global, Module } from '@nestjs/common';
import { QUEUE_SERVICE } from './queue.interface';
import { RedisQueueService } from './redis-queue.service';

/**
 * Global queue module (D — Dependency Inversion).
 * Any module can inject QUEUE_SERVICE without importing this module.
 */
@Global()
@Module({
  providers: [
    {
      provide: QUEUE_SERVICE,
      useClass: RedisQueueService,
    },
  ],
  exports: [QUEUE_SERVICE],
})
export class QueueModule {}
