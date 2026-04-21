import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATIONS_SERVICE } from './notifications.interface';
import { NotificationsService } from './notifications.service';
import { NotificationQueueProcessor } from './notification-queue.processor';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationQueueProcessor,
    { provide: NOTIFICATIONS_SERVICE, useExisting: NotificationsService },
  ],
  exports: [NotificationsService, NOTIFICATIONS_SERVICE],
})
export class NotificationsModule {}
