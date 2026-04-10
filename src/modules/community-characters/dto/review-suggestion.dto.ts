import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
