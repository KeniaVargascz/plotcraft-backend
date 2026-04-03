import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TimelineEventType, TimelineEventRelevance } from '@prisma/client';

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
}
