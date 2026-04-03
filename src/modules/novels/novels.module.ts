import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TimelineModule } from '../timeline/timeline.module';
import { PlannerModule } from '../planner/planner.module';
import { NovelsController } from './novels.controller';
import { NovelsService } from './novels.service';

@Module({
  imports: [PrismaModule, AuthModule, TimelineModule, PlannerModule],
  controllers: [NovelsController],
  providers: [NovelsService],
  exports: [NovelsService],
})
export class NovelsModule {}
