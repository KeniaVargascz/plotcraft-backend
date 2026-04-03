import { WorldGenre, WorldVisibility } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateWorldDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

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
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  mapUrl?: string;

  @IsOptional()
  @IsEnum(WorldGenre)
  genre?: WorldGenre | null;

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
