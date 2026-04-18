import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarningsController } from './warnings.controller';
import { WarningsService } from './warnings.service';

@Module({
  imports: [PrismaModule],
  controllers: [WarningsController],
  providers: [WarningsService],
  exports: [WarningsService],
})
export class WarningsModule {}
