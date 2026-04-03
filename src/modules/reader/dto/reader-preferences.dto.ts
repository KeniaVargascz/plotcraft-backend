import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class ReaderPreferencesDto {
  @IsOptional()
  @IsIn(['crimson', 'outfit', 'georgia', 'mono'])
  font_family?: 'crimson' | 'outfit' | 'georgia' | 'mono';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(14)
  @Max(26)
  font_size?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1.4)
  @Max(2.4)
  line_height?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(560)
  @Max(960)
  max_width?: number;

  @IsOptional()
  @IsIn(['scroll', 'paginated'])
  reading_mode?: 'scroll' | 'paginated';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  show_progress?: boolean;
}
