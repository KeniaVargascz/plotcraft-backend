import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommunityForumsController } from './community-forums.controller';
import { CommunityForumsService } from './community-forums.service';
import { ForumThreadsService } from './forum-threads.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CommunityForumsController],
  providers: [CommunityForumsService, ForumThreadsService],
  exports: [CommunityForumsService, ForumThreadsService],
})
export class CommunityForumsModule {}
