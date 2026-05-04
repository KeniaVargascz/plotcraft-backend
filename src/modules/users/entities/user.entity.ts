import { ApiProperty } from '@nestjs/swagger';
import { Profile } from '@prisma/client';

export class UserEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isAdmin!: boolean;

  @ApiProperty()
  role!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ required: false })
  lastLoginAt?: Date | null;

  @ApiProperty({ required: false })
  profile?: Profile | null;
}
