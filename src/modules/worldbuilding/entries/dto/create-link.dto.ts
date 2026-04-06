import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateLinkDto {
  @IsUUID()
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  relation!: string;

  @IsOptional()
  @IsBoolean()
  isMutual?: boolean;
}
