import {
  IsEnum,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  CharacterKinshipType,
  CharacterRelationshipCategory,
} from '@prisma/client';

export class CreateRelationshipDto {
  @IsUUID()
  targetId!: string;

  @IsOptional()
  @IsEnum(CharacterRelationshipCategory)
  category?: CharacterRelationshipCategory;

  @ValidateIf((dto: CreateRelationshipDto) => !dto.kinshipType)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type?: string;

  @IsOptional()
  @IsEnum(CharacterKinshipType)
  kinshipType?: CharacterKinshipType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isMutual?: boolean;
}
