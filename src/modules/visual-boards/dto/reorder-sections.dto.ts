import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class ReorderSectionEntryDto {
  @IsString()
  sectionId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderIndex!: number;
}

export class ReorderSectionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderSectionEntryDto)
  sections!: ReorderSectionEntryDto[];
}
