import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ReadingListsController } from './reading-lists.controller';
import { ReadingListsService } from './reading-lists.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReadingListsController],
  providers: [ReadingListsService],
  exports: [ReadingListsService],
})
export class ReadingListsModule {}
