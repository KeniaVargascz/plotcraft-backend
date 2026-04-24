import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ACTIVE', 'SUSPENDED', 'BANNED'])
  status!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
