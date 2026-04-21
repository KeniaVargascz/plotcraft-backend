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
import { NovelInteractionsService } from './services/novel-interactions.service';
import { NovelCharacterLinkService } from './services/novel-character-link.service';
import { NovelValidationService } from './services/novel-validation.service';

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
    NovelInteractionsService,
    NovelCharacterLinkService,
    NovelValidationService,
  ],
  exports: [
    NovelsService,
    KudosService,
    NovelCommentsService,
    SubscriptionsService,
    NovelInteractionsService,
    NovelCharacterLinkService,
    NovelValidationService,
  ],
})
export class NovelsModule {}
