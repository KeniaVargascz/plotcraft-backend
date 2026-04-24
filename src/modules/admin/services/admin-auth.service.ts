import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditService: AdminAuditService,
  ) {}

  async login(dto: AdminLoginDto) {
    const result = await this.authService.login({
      identifier: dto.email,
      password: dto.password,
    });

    // Verify the logged-in user is actually an admin
    const user = await this.prisma.user.findUnique({
      where: { id: result.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      throw new UnauthorizedException({
        code: 'NOT_ADMIN',
        message: 'Acceso restringido a administradores.',
      });
    }

    await this.auditService.log({
      adminId: result.user.id,
      adminEmail: result.user.email,
      action: 'LOGIN',
      resourceType: 'auth',
    });

    return result;
  }

  async getAdminProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        isAdmin: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!user.isAdmin) {
      throw new UnauthorizedException('Acceso restringido a administradores.');
    }

    return user;
  }
}
