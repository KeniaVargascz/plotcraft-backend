import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSectionDto {
  @MinLength(1)
  @MaxLength(200)
  @IsString()
  title!: string;
}
