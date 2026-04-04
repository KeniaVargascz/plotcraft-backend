import { IsNumber, Max, Min } from 'class-validator';

export class UpdateViewportDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  @Min(0.1)
  @Max(10)
  zoom!: number;
}
