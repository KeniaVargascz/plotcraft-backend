import { CharacterRole } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class LinkNovelCharacterDto {
  @IsOptional()
  @IsUUID()
  characterId?: string;

  @IsOptional()
  @IsUUID()
  communityCharacterId?: string;

  @IsOptional()
  @IsEnum(CharacterRole)
  roleInNovel?: CharacterRole;
}
