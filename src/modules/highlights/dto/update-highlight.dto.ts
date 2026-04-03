import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHighlightDto {
  @IsOptional()
  @IsIn(['yellow', 'green', 'blue', 'pink'])
  color?: 'yellow' | 'green' | 'blue' | 'pink';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
