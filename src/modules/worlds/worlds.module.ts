import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { NovelsModule } from '../novels/novels.module';
import { WorldsController } from './worlds.controller';
import { WORLDS_SERVICE } from './worlds.interface';
import { WorldsService } from './worlds.service';

@Module({
  imports: [PrismaModule, AuthModule, NovelsModule],
  controllers: [WorldsController],
  providers: [
    WorldsService,
    { provide: WORLDS_SERVICE, useExisting: WorldsService },
  ],
  exports: [WorldsService, WORLDS_SERVICE],
})
export class WorldsModule {}
