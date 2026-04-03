import { ApiProperty } from '@nestjs/swagger';

export class SearchResultItemDto {
  @ApiProperty({ enum: ['novel', 'world', 'character', 'user', 'post'] })
  type!: 'novel' | 'world' | 'character' | 'user' | 'post';

  @ApiProperty()
  score!: number;

  @ApiProperty({ additionalProperties: true })
  data!: Record<string, unknown>;
}
