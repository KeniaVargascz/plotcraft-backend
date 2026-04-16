import { CommunityType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsEnum(CommunityType)
  type!: CommunityType;

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

  @IsOptional()
  @IsUUID()
  linkedNovelId?: string;
}
