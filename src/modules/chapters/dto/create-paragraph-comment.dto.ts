import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateParagraphCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsString()
  @IsNotEmpty()
  anchor_id!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  quoted_text?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  start_offset?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  end_offset?: number;
}
