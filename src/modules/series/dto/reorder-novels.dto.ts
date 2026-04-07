import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReorderNovelItemDto {
  @IsUUID()
  novelId!: string;

  @IsInt()
  @Min(1)
  orderIndex!: number;
}

export class ReorderNovelsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderNovelItemDto)
  novels!: ReorderNovelItemDto[];
}
