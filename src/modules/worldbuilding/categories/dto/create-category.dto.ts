import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { FieldDefinitionDto } from './field-definition.dto';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @IsHexColor()
  color?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionDto)
  fieldSchema!: FieldDefinitionDto[];

  validateNoDuplicateKeys(): void {
    const keys = this.fieldSchema.map((field) => field.key);
    const unique = new Set(keys);
    if (unique.size !== keys.length) {
      throw new BadRequestException('fieldSchema contiene claves duplicadas');
    }
  }
}
