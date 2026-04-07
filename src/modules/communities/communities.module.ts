import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminCommunitiesController } from './admin-communities.controller';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityMembersService } from './community-members.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CommunitiesController, AdminCommunitiesController],
  providers: [CommunitiesService, CommunityMembersService],
  exports: [CommunitiesService, CommunityMembersService],
})
export class CommunitiesModule {}
