import { ApiProperty } from '@nestjs/swagger';

export class TrendingResponseDto {
  @ApiProperty({ type: [Object] })
  items!: Record<string, unknown>[];

  @ApiProperty({ enum: ['72h', '7d'] })
  period!: '72h' | '7d';

  @ApiProperty()
  generated_at!: string;
}
