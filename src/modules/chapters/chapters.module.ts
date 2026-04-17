import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NovelsModule } from '../novels/novels.module';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { ChapterCommentsService } from './chapter-comments.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NovelsModule, NotificationsModule],
  controllers: [ChaptersController],
  providers: [ChaptersService, ChapterCommentsService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
