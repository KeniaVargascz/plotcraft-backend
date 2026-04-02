import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,30}$/)
  username!: string;

  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX)
  password!: string;
}
