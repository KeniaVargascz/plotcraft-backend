import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersController } from './users.controller';
import { USERS_SERVICE } from './users.interface';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: USERS_SERVICE, useExisting: UsersService },
  ],
  exports: [UsersService, USERS_SERVICE],
})
export class UsersModule {}
