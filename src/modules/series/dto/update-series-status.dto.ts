import { SeriesStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSeriesStatusDto {
  @IsEnum(SeriesStatus)
  status!: SeriesStatus;
}
