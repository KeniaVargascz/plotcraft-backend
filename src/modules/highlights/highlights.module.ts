import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HighlightsController } from './highlights.controller';
import { HighlightsService } from './highlights.service';

@Module({
  imports: [PrismaModule],
  controllers: [HighlightsController],
  providers: [HighlightsService],
  exports: [HighlightsService],
})
export class HighlightsModule {}
