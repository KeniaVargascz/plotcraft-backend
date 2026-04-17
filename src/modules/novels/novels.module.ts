import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TimelineModule } from '../timeline/timeline.module';
import { PlannerModule } from '../planner/planner.module';
import { KudosService } from './kudos.service';
import { NovelCommentsService } from './novel-comments.service';
import { NovelsController } from './novels.controller';
import { NovelsService } from './novels.service';
import { SubscriptionsService } from './subscriptions.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TimelineModule,
    PlannerModule,
    NotificationsModule,
  ],
  controllers: [NovelsController],
  providers: [
    NovelsService,
    KudosService,
    NovelCommentsService,
    SubscriptionsService,
  ],
  exports: [
    NovelsService,
    KudosService,
    NovelCommentsService,
    SubscriptionsService,
  ],
})
export class NovelsModule {}
