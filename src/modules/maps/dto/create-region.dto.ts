import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RegionPointDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;
}

export class CreateRegionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  borderColor?: string;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RegionPointDto)
  points!: RegionPointDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
