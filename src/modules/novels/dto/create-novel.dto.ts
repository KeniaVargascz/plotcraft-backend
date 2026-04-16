import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NovelRating, NovelStatus, NovelType } from '@prisma/client';

export class NovelPairingDto {
  @IsUUID()
  characterAId!: string;

  @IsUUID()
  characterBId!: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

export class CreateNovelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  synopsis?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'coverUrl debe ser una URL valida' })
  coverUrl?: string;

  @IsOptional()
  @IsEnum(NovelStatus)
  status?: NovelStatus;

  @IsOptional()
  @IsEnum(NovelRating)
  rating?: NovelRating;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  warnings?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('all', { each: true })
  genreIds?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsUUID()
  languageId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('all', { each: true })
  romanceGenreIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => NovelPairingDto)
  pairings?: NovelPairingDto[];

  @IsOptional()
  @IsEnum(NovelType)
  novelType?: NovelType;

  @IsOptional()
  @IsBoolean()
  isAlternateUniverse?: boolean;

  @IsOptional()
  @IsUUID()
  linkedCommunityId?: string;
}
