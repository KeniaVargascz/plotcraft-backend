import { NovelRating, NovelStatus, RomanceGenre } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type NovelSortOption =
  | 'recent'
  | 'popular'
  | 'views'
  | 'newest'
  | 'recently_updated'
  | 'most_voted'
  | 'most_kudos'
  | 'most_chapters'
  | 'most_words';

export class NovelQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 12;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  genres?: string[];

  @IsOptional()
  @IsEnum(NovelStatus)
  status?: NovelStatus;

  @IsOptional()
  @IsEnum(NovelRating)
  rating?: NovelRating;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn([
    'recent',
    'popular',
    'views',
    'newest',
    'recently_updated',
    'most_voted',
    'most_kudos',
    'most_chapters',
    'most_words',
  ])
  sort?: NovelSortOption;

  @IsOptional()
  @IsIn([
    'recent',
    'popular',
    'views',
    'newest',
    'recently_updated',
    'most_voted',
    'most_kudos',
    'most_chapters',
    'most_words',
  ])
  sortBy?: NovelSortOption;

  @IsOptional()
  @IsUUID()
  languageId?: string;

  @IsOptional()
  @IsDateString()
  updatedAfter?: string;

  @IsOptional()
  @IsDateString()
  updatedBefore?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  ships?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(RomanceGenre, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  romanceGenres?: RomanceGenre[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pairingA?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pairingB?: string;

  // Multi-pairing filter: each entry is "characterA|characterB"
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(220, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  pairings?: string[];
}
