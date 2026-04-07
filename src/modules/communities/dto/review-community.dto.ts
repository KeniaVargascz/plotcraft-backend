import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewCommunityDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
