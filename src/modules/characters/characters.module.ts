import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NovelsModule } from '../novels/novels.module';
import { WorldsModule } from '../worlds/worlds.module';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';
import { CharacterRelationshipService } from './services/character-relationship.service';
import { CharacterNovelLinkService } from './services/character-novel-link.service';

@Module({
  imports: [PrismaModule, AuthModule, NovelsModule, WorldsModule],
  controllers: [CharactersController],
  providers: [
    CharactersService,
    CharacterRelationshipService,
    CharacterNovelLinkService,
  ],
  exports: [CharactersService],
})
export class CharactersModule {}
