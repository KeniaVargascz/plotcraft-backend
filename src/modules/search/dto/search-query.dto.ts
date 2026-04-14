import {
  CharacterRole,
  CharacterStatus,
  NovelRating,
  NovelStatus,
  PostType,
} from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SearchQueryDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  q!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class SearchNovelsQueryDto extends SearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ enum: NovelRating })
  @IsOptional()
  @IsEnum(NovelRating)
  rating?: NovelRating;

  @ApiPropertyOptional({ enum: NovelStatus })
  @IsOptional()
  @IsEnum(NovelStatus)
  status?: NovelStatus;

  @ApiPropertyOptional({ enum: ['relevance', 'recent', 'popular', 'views'] })
  @IsOptional()
  @IsIn(['relevance', 'recent', 'popular', 'views'])
  sort: 'relevance' | 'recent' | 'popular' | 'views' = 'relevance';
}

export class SearchWorldsQueryDto extends SearchQueryDto {
  @ApiPropertyOptional({ enum: ['relevance', 'recent', 'popular'] })
  @IsOptional()
  @IsIn(['relevance', 'recent', 'popular'])
  sort: 'relevance' | 'recent' | 'popular' = 'relevance';
}

export class SearchCharactersQueryDto extends SearchQueryDto {
  @ApiPropertyOptional({ enum: CharacterRole })
  @IsOptional()
  @IsEnum(CharacterRole)
  role?: CharacterRole;

  @ApiPropertyOptional({ enum: CharacterStatus })
  @IsOptional()
  @IsEnum(CharacterStatus)
  status?: CharacterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  world_id?: string;
}

export class SearchUsersQueryDto extends SearchQueryDto {
  @ApiPropertyOptional({ enum: ['relevance', 'followers', 'recent'] })
  @IsOptional()
  @IsIn(['relevance', 'followers', 'recent'])
  sort: 'relevance' | 'followers' | 'recent' = 'relevance';
}

export class SearchPostsQueryDto extends SearchQueryDto {
  @ApiPropertyOptional({ enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @ApiPropertyOptional({ enum: ['relevance', 'recent', 'reactions'] })
  @IsOptional()
  @IsIn(['relevance', 'recent', 'reactions'])
  sort: 'relevance' | 'recent' | 'reactions' = 'relevance';
}

export class SearchUnifiedQueryDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  q!: string;

  @ApiPropertyOptional({
    isArray: true,
    enum: [
      'novels',
      'worlds',
      'characters',
      'users',
      'posts',
      'threads',
      'communities',
    ],
  })
  @IsOptional()
  types?: string[] | string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class SearchSuggestionsQueryDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  q!: string;
}
