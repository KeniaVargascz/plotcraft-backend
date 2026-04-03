import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  newFollower?: boolean;

  @IsOptional()
  @IsBoolean()
  newCommentOnPost?: boolean;

  @IsOptional()
  @IsBoolean()
  newReactionOnPost?: boolean;

  @IsOptional()
  @IsBoolean()
  newReplyInThread?: boolean;

  @IsOptional()
  @IsBoolean()
  newChapterFromFollowed?: boolean;

  @IsOptional()
  @IsBoolean()
  novelMilestone?: boolean;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}
