import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TEMPLATE_KEYS } from '../../constants/category-templates.const';

export class InstantiateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(TEMPLATE_KEYS)
  templateKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}
