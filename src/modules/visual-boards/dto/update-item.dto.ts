import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;
}
