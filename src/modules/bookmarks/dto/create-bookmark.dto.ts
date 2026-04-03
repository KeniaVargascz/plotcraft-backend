import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBookmarkDto {
  @IsUUID()
  chapter_id!: string;

  @IsUUID()
  novel_id!: string;

  @IsOptional()
  @IsString()
  anchor_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
