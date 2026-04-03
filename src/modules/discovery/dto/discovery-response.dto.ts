import { ApiProperty } from '@nestjs/swagger';

export class DiscoveryResponseDto {
  @ApiProperty({ additionalProperties: true })
  trending!: {
    novels: Record<string, unknown>[];
    worlds: Record<string, unknown>[];
    characters: Record<string, unknown>[];
    authors: Record<string, unknown>[];
  };

  @ApiProperty({ type: [Object] })
  new_releases!: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  genres_spotlight!: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  community_posts!: Record<string, unknown>[];

  @ApiProperty({ additionalProperties: true })
  stats!: {
    total_novels: number;
    total_authors: number;
    total_worlds: number;
    total_characters: number;
    total_chapters_published: number;
  };
}
