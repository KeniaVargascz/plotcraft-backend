import { CharacterRole, CharacterStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateCharacterDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  alias?: string[];

  @IsOptional()
  @IsUUID()
  worldId?: string | null;

  @IsOptional()
  @IsEnum(CharacterRole)
  role?: CharacterRole;

  @IsOptional()
  @IsEnum(CharacterStatus)
  status?: CharacterStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  age?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  appearance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  personality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  motivations?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  fears?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  strengths?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  weaknesses?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  backstory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  arc?: string;

  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: 'avatarUrl debe ser una URL valida' },
  )
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
