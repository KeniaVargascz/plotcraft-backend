import { ForumCategory, ThreadStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ThreadQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsEnum(ForumCategory)
  category?: ForumCategory;

  @IsOptional()
  @IsEnum(ThreadStatus)
  status?: ThreadStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['recent', 'popular', 'replies', 'unanswered'])
  sort?: 'recent' | 'popular' | 'replies' | 'unanswered';

  @IsOptional()
  @IsString()
  tags?: string;
}
