import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateRelationshipDto {
  @IsUUID()
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isMutual?: boolean;
}
