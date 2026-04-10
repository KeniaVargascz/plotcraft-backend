import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class ReorderItemEntryDto {
  @IsString()
  itemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderIndex!: number;
}

export class ReorderItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemEntryDto)
  items!: ReorderItemEntryDto[];
}
