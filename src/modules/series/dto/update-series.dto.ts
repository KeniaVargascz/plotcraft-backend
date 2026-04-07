import { OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { CreateSeriesDto } from './create-series.dto';

export class UpdateSeriesDto extends PartialType(
  OmitType(CreateSeriesDto, ['type'] as const),
) {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId?: string | null;
}
