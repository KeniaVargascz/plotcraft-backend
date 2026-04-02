import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NovelsModule } from '../novels/novels.module';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';

@Module({
  imports: [PrismaModule, NovelsModule],
  controllers: [ChaptersController],
  providers: [ChaptersService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
