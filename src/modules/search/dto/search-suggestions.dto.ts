import { ApiProperty } from '@nestjs/swagger';

class SearchSuggestionItemDto {
  @ApiProperty({ enum: ['novel', 'user', 'world', 'character'] })
  type!: 'novel' | 'user' | 'world' | 'character';

  @ApiProperty()
  label!: string;

  @ApiProperty()
  sublabel!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ nullable: true })
  avatar_url!: string | null;
}

export class SearchSuggestionsDto {
  @ApiProperty({ type: [SearchSuggestionItemDto] })
  suggestions!: SearchSuggestionItemDto[];
}
