import { ApiProperty } from '@nestjs/swagger';

export class FeaturedResponseDto {
  @ApiProperty({ type: [Object] })
  novels!: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  worlds!: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  authors!: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  posts!: Record<string, unknown>[];
}
