import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService, CACHE_SERVICE } from '../../../common/services/cache.service';
import { OtpService } from '../../otp/otp.service';
import { SmsService } from '../../sms/sms.service';
import { EmailService } from '../../email/email.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminTfaService } from './admin-tfa.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { Role, hasRole } from '../../../common/constants/roles';

const SALT_ROUNDS = 12;

@Injectable()
export class AdminPasswordService {
  private readonly logger = new Logger(AdminPasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly auditService: AdminAuditService,
    private readonly tfaService: AdminTfaService,
  ) {}

  /**
   * Change password (admin is logged in)
   * Requires: current password + new password + 2FA code
   */
  async changePassword(
    admin: JwtPayload,
    dto: { currentPassword: string; newPassword: string; tfaCode: string },
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: admin.sub },
      select: { id: true, email: true, passwordHash: true, tfaEnabled: true },
    });

    // Verify current password
    const passwordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }

    // Verify 2FA
    if (user.tfaEnabled) {
      await this.tfaService.verifyLogin(user.id, dto.tfaCode);
    }

    // Update password
    const newHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate all existing sessions
    await this.invalidateAllSessions(user.id);

    await this.auditService.log({
      adminId: user.id,
      adminEmail: user.email,
      action: 'ADMIN_PASSWORD_CHANGED',
      resourceType: 'auth',
    });

    // Notify admin via email
    this.notifyPasswordChange(user.email, 'changed').catch(() => {});

    return { message: 'Password changed successfully' };
  }

  /**
   * Forgot password — send OTP via SMS or WhatsApp
   * Admin identifies by email, OTP sent to their phone
   */
  async forgotPassword(
    dto: { email: string; channel?: 'sms' | 'whatsapp' },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      select: { id: true, email: true, isAdmin: true, role: true, isActive: true, phone: true, username: true },
    });

    // Constant-time response regardless of user existence
    if (!user || !hasRole(user.role, Role.MASTER) || !user.isActive) {
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 30));
      return { message: 'If the account exists, an OTP has been sent' };
    }

    if (!user.phone) {
      this.logger.warn(`Admin ${user.id} has no phone configured — cannot send OTP`);
      return { message: 'If the account exists, an OTP has been sent' };
    }

    const plainCode = await this.otpService.create(user.id, 'ADMIN_PASSWORD_RESET');
    const channel = dto.channel ?? 'sms';

    // Fire-and-forget
    this.smsService.sendOtp(user.phone, plainCode, channel).then((result) => {
      if (!result.success) {
        this.logger.warn(`Admin OTP ${channel} failed for userId=${user.id}: ${result.error}`);
      }
    }).catch((err) => {
      this.logger.warn(`Admin OTP ${channel} error for userId=${user.id}: ${err}`);
    });

    return { message: 'If the account exists, an OTP has been sent' };
  }

  /**
   * Reset password with OTP code
   * Requires: email + OTP code + new password
   */
  async resetPassword(
    dto: { email: string; code: string; newPassword: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      select: { id: true, email: true, isAdmin: true, role: true },
    });

    if (!user || !hasRole(user.role, Role.MASTER)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid reset request',
        code: 'INVALID_RESET_REQUEST',
      });
    }

    const result = await this.otpService.verify(user.id, dto.code, 'ADMIN_PASSWORD_RESET');
    if (!result.valid) {
      const reason = !result.valid ? result.reason : 'unknown';
      if (reason === 'expired') {
        throw new BadRequestException({ statusCode: 400, message: 'OTP code expired', code: 'OTP_EXPIRED' });
      }
      if (reason === 'too_many_attempts') {
        throw new BadRequestException({ statusCode: 400, message: 'Too many attempts', code: 'TOO_MANY_ATTEMPTS' });
      }
      throw new BadRequestException({ statusCode: 400, message: 'Invalid OTP code', code: 'OTP_INVALID' });
    }

    const newHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Invalidate all existing sessions
    await this.invalidateAllSessions(user.id);

    await this.auditService.log({
      adminId: user.id,
      adminEmail: user.email,
      action: 'ADMIN_PASSWORD_RESET',
      resourceType: 'auth',
    });

    // Notify admin via email
    this.notifyPasswordChange(user.email, 'reset').catch(() => {});

    return { message: 'Password reset successfully' };
  }

  /**
   * Update admin phone number (for OTP delivery)
   */
  async updatePhone(admin: JwtPayload, dto: { phone: string; tfaCode: string }) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: admin.sub },
      select: { id: true, email: true, tfaEnabled: true },
    });

    // Always require 2FA verification for phone changes — no exceptions
    await this.tfaService.verifyLogin(user.id, dto.tfaCode);

    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    if (!dto.phone || !phoneRegex.test(dto.phone)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Valid phone number in E.164 format required (e.g. +521234567890)',
        code: 'INVALID_PHONE_FORMAT',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { phone: dto.phone },
    });

    await this.auditService.log({
      adminId: user.id,
      adminEmail: user.email,
      action: 'ADMIN_PHONE_UPDATED',
      resourceType: 'auth',
    });

    return { message: 'Phone updated successfully' };
  }

  private async notifyPasswordChange(email: string, action: 'changed' | 'reset'): Promise<void> {
    const subject = action === 'changed'
      ? 'PlotCraft Admin: Password changed'
      : 'PlotCraft Admin: Password reset';
    const body = action === 'changed'
      ? 'Your admin password was changed. If you did not do this, contact support immediately.'
      : 'Your admin password was reset. If you did not request this, contact support immediately.';

    // Use the password reset OTP template as a simple notification
    await this.emailService.sendPasswordResetOtp({
      to: email,
      username: 'Admin',
      code: body, // Repurpose code field as message body
      expiresInMinutes: 0,
    });
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    await this.cache.set(
      `blacklist:user:${userId}`,
      Math.floor(Date.now() / 1000),
      60 * 60 * 1000,
    );
  }
}
