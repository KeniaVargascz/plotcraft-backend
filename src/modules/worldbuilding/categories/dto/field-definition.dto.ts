import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class FieldDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z_]{1,50}$/, {
    message: 'key debe ser snake_case (a-z y _) de 1 a 50 caracteres',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @IsString()
  @IsIn([
    'text',
    'textarea',
    'number',
    'boolean',
    'select',
    'multiselect',
    'url',
    'markdown',
  ])
  type!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean = false;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string | null = null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[] | null = null;

  @IsOptional()
  default?: unknown = null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;
}
