import { ApiProperty } from '@nestjs/swagger';

class SearchSectionDto {
  @ApiProperty({ type: [Object] })
  items!: Record<string, unknown>[];

  @ApiProperty()
  total_hint!: number;
}

export class SearchResponseDto {
  @ApiProperty()
  query!: string;

  @ApiProperty({
    type: Object,
    additionalProperties: false,
  })
  results!: {
    novels: SearchSectionDto;
    worlds: SearchSectionDto;
    characters: SearchSectionDto;
    users: SearchSectionDto;
    posts: SearchSectionDto;
  };
}
