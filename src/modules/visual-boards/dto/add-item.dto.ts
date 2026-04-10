import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class AddItemDto {
  @IsUrl({
    require_tld: false,
    require_protocol: true,
  })
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;
}
