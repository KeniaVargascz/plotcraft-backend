import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterInitiateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nickname!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,28}[a-zA-Z0-9]$/)
  username!: string;

  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => (value as string)?.toLowerCase().trim())
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @IsBoolean()
  acceptTerms!: boolean;
}
