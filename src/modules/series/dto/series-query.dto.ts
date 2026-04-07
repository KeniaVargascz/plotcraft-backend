import { SeriesStatus, SeriesType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SeriesQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  authorUsername?: string;

  @IsOptional()
  @IsEnum(SeriesType)
  type?: SeriesType;

  @IsOptional()
  @IsEnum(SeriesStatus)
  status?: SeriesStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
