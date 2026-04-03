import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;
}
