import { ReactionType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ToggleReactionDto {
  @IsOptional()
  @IsEnum(ReactionType)
  reactionType?: ReactionType;
}
