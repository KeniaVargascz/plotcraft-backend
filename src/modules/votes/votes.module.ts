import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

@Module({
  imports: [PrismaModule],
  controllers: [VotesController],
  providers: [VotesService],
  exports: [VotesService],
})
export class VotesModule {}
