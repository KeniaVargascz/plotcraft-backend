import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateRegionPointDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;
}

export class UpdateRegionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  borderColor?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpdateRegionPointDto)
  points?: UpdateRegionPointDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
