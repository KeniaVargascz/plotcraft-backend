import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateBoardDto {
  @MinLength(1)
  @MaxLength(200)
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ enum: ['novel', 'world', 'character', 'series'] })
  @IsOptional()
  @IsString()
  @IsIn(['novel', 'world', 'character', 'series'])
  linkedType?: string;

  @IsOptional()
  @IsUUID()
  linkedId?: string;
}
