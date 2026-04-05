import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const HTTP_URL_REGEX = /^https?:\/\/[^\s]+$/i;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @Matches(HTTP_URL_REGEX, { message: 'website debe ser una URL valida' })
  website?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @Matches(HTTP_URL_REGEX, { message: 'avatarUrl debe ser una URL valida' })
  avatarUrl?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @Matches(HTTP_URL_REGEX, { message: 'bannerUrl debe ser una URL valida' })
  bannerUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
