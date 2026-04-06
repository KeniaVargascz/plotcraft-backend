import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TimelineModule } from '../timeline/timeline.module';
import { PlannerModule } from '../planner/planner.module';
import { KudosService } from './kudos.service';
import { NovelsController } from './novels.controller';
import { NovelsService } from './novels.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, TimelineModule, PlannerModule, NotificationsModule],
  controllers: [NovelsController],
  providers: [NovelsService, KudosService],
  exports: [NovelsService, KudosService],
})
export class NovelsModule {}
