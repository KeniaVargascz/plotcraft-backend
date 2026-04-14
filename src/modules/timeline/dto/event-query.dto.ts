import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { TimelineEventType, TimelineEventRelevance } from '@prisma/client';
import { Transform } from 'class-transformer';

export class EventQueryDto {
  @IsOptional()
  @IsEnum(TimelineEventType)
  type?: TimelineEventType;

  @IsOptional()
  @IsEnum(TimelineEventRelevance)
  relevance?: TimelineEventRelevance;

  @IsOptional()
  @IsUUID()
  characterId?: string;

  @IsOptional()
  @IsUUID()
  chapterId?: string;

  @IsOptional()
  @IsUUID()
  worldId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['order', 'type', 'relevance'])
  sort?: 'order' | 'type' | 'relevance' = 'order';

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
