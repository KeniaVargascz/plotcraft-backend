import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rules?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'coverUrl debe ser una URL valida' })
  coverUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'bannerUrl debe ser una URL valida' })
  bannerUrl?: string;
}
