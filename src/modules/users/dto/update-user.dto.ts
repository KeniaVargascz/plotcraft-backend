import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidationArguments,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

@ValidatorConstraint({ name: 'requiresCurrentPassword', async: false })
class RequiresCurrentPasswordConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, context?: ValidationArguments): boolean {
    const dto = context?.object as UpdateUserDto | undefined;
    return !(dto?.newPassword && !dto.currentPassword);
  }

  defaultMessage(): string {
    return 'current_password: Debes ingresar tu contrasena actual para cambiarla';
  }
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^[a-zA-Z0-9_.-]{3,30}$/)
  username?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX)
  @Validate(RequiresCurrentPasswordConstraint)
  newPassword?: string;
}
