import { IsInt, IsUUID, Min } from 'class-validator';

export class AddNovelToSeriesDto {
  @IsUUID()
  novelId!: string;

  @IsInt()
  @Min(1)
  orderIndex!: number;
}
