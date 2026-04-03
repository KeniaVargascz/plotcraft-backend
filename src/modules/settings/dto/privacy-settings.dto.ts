import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacySettingsDto {
  @IsOptional()
  @IsBoolean()
  showReadingActivity?: boolean;

  @IsOptional()
  @IsBoolean()
  showReadingLists?: boolean;

  @IsOptional()
  @IsBoolean()
  showFollows?: boolean;

  @IsOptional()
  @IsBoolean()
  showStats?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  searchable?: boolean;
}
