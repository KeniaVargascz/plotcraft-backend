import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorldsModule } from '../worlds/worlds.module';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { EntriesController } from './entries/entries.controller';
import { EntriesService } from './entries/entries.service';

@Module({
  imports: [PrismaModule, AuthModule, WorldsModule],
  controllers: [CategoriesController, EntriesController],
  providers: [CategoriesService, EntriesService],
  exports: [CategoriesService, EntriesService],
})
export class WorldbuildingModule {}
