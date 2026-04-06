import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KudosController } from './kudos.controller';
import { KudosService } from './kudos.service';

@Module({
  imports: [PrismaModule],
  controllers: [KudosController],
  providers: [KudosService],
  exports: [KudosService],
})
export class KudosModule {}
