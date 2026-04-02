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
      throw new NotFoundException('Usuario no encontrado');
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
        throw new ConflictException('El email ya esta en uso');
      }

      updateData.email = normalizedEmail;
    }

    if (dto.username) {
      const normalizedUsername = dto.username.trim();
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: normalizedUsername },
      });

      if (existingUsername && existingUsername.id !== id) {
        throw new ConflictException('El username ya esta en uso');
      }

      updateData.username = normalizedUsername;
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new ForbiddenException(
          'Debes ingresar tu contrasena actual para cambiarla',
        );
      }

      const passwordMatches = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!passwordMatches) {
        throw new ForbiddenException('La contrasena actual no es valida');
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
      throw new ForbiddenException('La contrasena es incorrecta');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Cuenta eliminada correctamente' };
  }

  toUserEntity(
    user: UserWithProfile | (User & { profile?: UserWithProfile['profile'] }),
  ): UserEntity {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile ?? null,
    };
  }
}
