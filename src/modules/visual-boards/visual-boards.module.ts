import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { VisualBoardsController } from './visual-boards.controller';
import { VisualBoardsService } from './visual-boards.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [VisualBoardsController],
  providers: [VisualBoardsService],
  exports: [VisualBoardsService],
})
export class VisualBoardsModule {}
