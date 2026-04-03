import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateHighlightDto {
  @IsUUID()
  chapter_id!: string;

  @IsUUID()
  novel_id!: string;

  @IsString()
  @IsNotEmpty()
  anchor_id!: string;

  @IsInt()
  @Min(0)
  start_offset!: number;

  @IsInt()
  @Min(1)
  end_offset!: number;

  @IsOptional()
  @IsIn(['yellow', 'green', 'blue', 'pink'])
  color?: 'yellow' | 'green' | 'blue' | 'pink';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
