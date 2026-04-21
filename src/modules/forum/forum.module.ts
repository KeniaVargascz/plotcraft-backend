import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { ForumReplyService } from './services/forum-reply.service';
import { ForumReactionService } from './services/forum-reaction.service';
import { ForumPollService } from './services/forum-poll.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [ForumController],
  providers: [ForumService, ForumReplyService, ForumReactionService, ForumPollService],
  exports: [ForumService],
})
export class ForumModule {}
