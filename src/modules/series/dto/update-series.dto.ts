import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateSeriesDto } from './create-series.dto';

export class UpdateSeriesDto extends PartialType(
  OmitType(CreateSeriesDto, ['type'] as const),
) {}
