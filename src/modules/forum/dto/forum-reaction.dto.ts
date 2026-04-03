import { ForumReactionType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ForumReactionDto {
  @IsOptional()
  @IsEnum(ForumReactionType)
  reactionType?: ForumReactionType = ForumReactionType.LIKE;
}
