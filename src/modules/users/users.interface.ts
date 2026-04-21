import { Prisma, User } from '@prisma/client';
import { UserEntity } from './entities/user.entity';

type UserWithProfile = Prisma.UserGetPayload<{ include: { profile: true } }>;

export const USERS_SERVICE = 'USERS_SERVICE';

export interface IUsersService {
  findByIdOrFail(id: string): Promise<UserWithProfile>;
  getCurrentUser(id: string): Promise<UserEntity>;
  toUserEntity(
    user: UserWithProfile | (User & { profile?: UserWithProfile['profile'] }),
  ): UserEntity;
}
