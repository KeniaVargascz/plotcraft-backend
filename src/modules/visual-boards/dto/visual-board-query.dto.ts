import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class VisualBoardQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  @IsIn(['novel', 'world', 'character', 'series', 'free'])
  linkedType?: 'novel' | 'world' | 'character' | 'series' | 'free';

  @IsOptional()
  @IsUUID()
  linkedId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isPublic?: boolean;
}
