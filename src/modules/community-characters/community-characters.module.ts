import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunityCharactersController } from './community-characters.controller';
import { CommunityCharactersService } from './community-characters.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [CommunityCharactersController],
  providers: [CommunityCharactersService],
  exports: [CommunityCharactersService],
})
export class CommunityCharactersModule {}
