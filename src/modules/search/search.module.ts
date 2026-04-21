import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchNovelsService } from './services/search-novels.service';
import { SearchWorldsService } from './services/search-worlds.service';
import { SearchContentService } from './services/search-content.service';
import { SearchHistoryService } from './services/search-history.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, AuthModule, SettingsModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    SearchNovelsService,
    SearchWorldsService,
    SearchContentService,
    SearchHistoryService,
  ],
  exports: [SearchService],
})
export class SearchModule {}
