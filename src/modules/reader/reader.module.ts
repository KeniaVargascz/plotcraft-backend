import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NovelsModule } from '../novels/novels.module';
import { ReaderController } from './reader.controller';
import { ReaderService } from './reader.service';
import { ReadingProgressBuffer } from './reading-progress-buffer.service';

@Module({
  imports: [PrismaModule, NovelsModule],
  controllers: [ReaderController],
  providers: [ReaderService, ReadingProgressBuffer],
  exports: [ReaderService],
})
export class ReaderModule {}
