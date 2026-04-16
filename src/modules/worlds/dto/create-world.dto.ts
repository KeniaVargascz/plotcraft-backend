import { WorldGenre, WorldVisibility } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateWorldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  setting?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  magicSystem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rules?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'coverUrl debe ser una URL valida' })
  coverUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'mapUrl debe ser una URL valida' })
  mapUrl?: string;

  @IsOptional()
  @IsEnum(WorldGenre)
  genre?: WorldGenre;

  @IsOptional()
  @IsEnum(WorldVisibility)
  visibility?: WorldVisibility;

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
