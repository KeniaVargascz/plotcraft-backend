import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OtpType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CacheService,
  CACHE_SERVICE,
} from '../../common/services/cache.service';
import {
  OTP_EXPIRY_MINUTES,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
} from './otp.constants';

const OTP_ATTEMPTS_PREFIX = 'otp:attempts:';
const OTP_LAST_ATTEMPT_PREFIX = 'otp:lastAttempt:';
const OTP_ATTEMPTS_TTL_MS = OTP_EXPIRY_MINUTES * 60 * 1000;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  private generateCode(): string {
    return Array.from({ length: OTP_LENGTH }, () =>
      Math.floor(Math.random() * 10),
    ).join('');
  }

  async create(userId: string, type: OtpType): Promise<string> {
    const plainCode = this.generateCode();
    const hashedCode = await bcrypt.hash(plainCode, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpCode.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.otpCode.create({
      data: { userId, code: hashedCode, type, expiresAt },
    });

    return plainCode;
  }

  async verify(
    userId: string,
    plainCode: string,
    type: OtpType,
  ): Promise<
    | { valid: true }
    | {
        valid: false;
        reason: 'not_found' | 'expired' | 'invalid' | 'too_many_attempts';
      }
  > {
    // Track attempts per user+type — survives OTP resend cycles
    const cacheKey = `${OTP_ATTEMPTS_PREFIX}${userId}:${type}`;
    const lastAttemptKey = `${OTP_LAST_ATTEMPT_PREFIX}${userId}:${type}`;
    const currentAttempts = (await this.cache.get<number>(cacheKey)) ?? 0;

    if (currentAttempts >= OTP_MAX_ATTEMPTS) {
      return { valid: false, reason: 'too_many_attempts' };
    }

    // Exponential backoff: 0s, 2s, 4s, 8s, 16s
    if (currentAttempts > 0) {
      const lastAttempt = (await this.cache.get<number>(lastAttemptKey)) ?? 0;
      const backoffMs = Math.pow(2, currentAttempts) * 1000;
      if (Date.now() - lastAttempt < backoffMs) {
        return { valid: false, reason: 'too_many_attempts' };
      }
    }

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: { userId, type, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return { valid: false, reason: 'not_found' };
    }

    if (otpRecord.expiresAt < new Date()) {
      return { valid: false, reason: 'expired' };
    }

    const isMatch = await bcrypt.compare(plainCode, otpRecord.code);

    // Always increment attempts (constant-time path)
    const attempts = currentAttempts + 1;

    if (!isMatch) {
      await this.cache.set(cacheKey, attempts, OTP_ATTEMPTS_TTL_MS);
      await this.cache.set(lastAttemptKey, Date.now(), OTP_ATTEMPTS_TTL_MS);

      if (attempts >= OTP_MAX_ATTEMPTS) {
        // Burn all active OTPs for this user+type
        await this.prisma.otpCode.updateMany({
          where: { userId, type, usedAt: null },
          data: { usedAt: new Date() },
        });
        return { valid: false, reason: 'too_many_attempts' };
      }

      return { valid: false, reason: 'invalid' };
    }

    // Success — mark OTP as used and clear attempts
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });
    await this.cache.del(cacheKey);

    return { valid: true };
  }
}
