import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { DeleteUserDto } from './dto/delete-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';

type UserWithProfile = Prisma.UserGetPayload<{ include: { profile: true } }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrFail(id: string): Promise<UserWithProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    return user;
  }

  async getCurrentUser(id: string): Promise<UserEntity> {
    return this.toUserEntity(await this.findByIdOrFail(id));
  }

  async updateCurrentUser(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findByIdOrFail(id);
    const updateData: Prisma.UserUpdateInput = {};

    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase().trim();
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingEmail && existingEmail.id !== id) {
        throw new ConflictException({ statusCode: 409, message: 'Email is already in use', code: 'EMAIL_ALREADY_IN_USE' });
      }

      updateData.email = normalizedEmail;
    }

    if (dto.username) {
      const normalizedUsername = dto.username.trim();
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: normalizedUsername },
      });

      if (existingUsername && existingUsername.id !== id) {
        throw new ConflictException({ statusCode: 409, message: 'Username is already in use', code: 'USERNAME_ALREADY_IN_USE' });
      }

      updateData.username = normalizedUsername;
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new ForbiddenException({ statusCode: 403, message: 'You must provide your current password to change it', code: 'CURRENT_PASSWORD_REQUIRED' });
      }

      const passwordMatches = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!passwordMatches) {
        throw new ForbiddenException({ statusCode: 403, message: 'Current password is invalid', code: 'CURRENT_PASSWORD_INVALID' });
      }

      updateData.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { profile: true },
    });

    return this.toUserEntity(updatedUser);
  }

  async deleteCurrentUser(
    id: string,
    dto: DeleteUserDto,
  ): Promise<{ message: string }> {
    const user = await this.findByIdOrFail(id);
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new ForbiddenException({ statusCode: 403, message: 'Password is incorrect', code: 'PASSWORD_INCORRECT' });
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Account deleted successfully' };
  }

  toUserEntity(
    user: UserWithProfile | (User & { profile?: UserWithProfile['profile'] }),
  ): UserEntity {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      isActive: user.isActive,
      isAdmin: user.isAdmin,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt ?? null,
      profile: user.profile ?? null,
    };
  }
}
