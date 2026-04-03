import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  Matches,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { TimelineEventType, TimelineEventRelevance } from '@prisma/client';

export class UpdateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TimelineEventType)
  @IsOptional()
  type?: TimelineEventType;

  @IsEnum(TimelineEventRelevance)
  @IsOptional()
  relevance?: TimelineEventRelevance;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  dateLabel?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @Matches(/^#[0-9a-fA-F]{6}$/)
  @IsOptional()
  color?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  tags?: string[];

  @IsUUID()
  @IsOptional()
  chapterId?: string;

  @IsUUID()
  @IsOptional()
  characterId?: string;

  @IsUUID()
  @IsOptional()
  worldId?: string;

  @IsUUID()
  @IsOptional()
  wbEntryId?: string;
}
