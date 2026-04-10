import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommunityCharacterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
