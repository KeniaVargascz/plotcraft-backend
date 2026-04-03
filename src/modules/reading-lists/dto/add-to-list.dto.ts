import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddToListDto {
  @IsUUID()
  novel_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  personal_note?: string;
}
