import { Transform } from 'class-transformer';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsUUID()
  novel_id!: string;

  @IsUUID()
  chapter_id!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  scroll_pct!: number;
}
