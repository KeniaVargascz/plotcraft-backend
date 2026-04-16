import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RomanceGenresController } from './romance-genres.controller';
import { RomanceGenresService } from './romance-genres.service';

@Module({
  imports: [PrismaModule],
  controllers: [RomanceGenresController],
  providers: [RomanceGenresService],
  exports: [RomanceGenresService],
})
export class RomanceGenresModule {}
