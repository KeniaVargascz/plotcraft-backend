import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NovelsModule } from '../novels/novels.module';
import { ReaderController } from './reader.controller';
import { ReaderService } from './reader.service';

@Module({
  imports: [PrismaModule, NovelsModule],
  controllers: [ReaderController],
  providers: [ReaderService],
  exports: [ReaderService],
})
export class ReaderModule {}
