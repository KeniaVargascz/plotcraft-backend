import * as bcrypt from 'bcrypt';
import { OtpService } from '../../modules/otp/otp.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('OtpService', () => {
  const prisma = {
    otpCode: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  let service: OtpService;
  const bcryptHash = jest.mocked(bcrypt.hash);
  const bcryptCompare = jest.mocked(bcrypt.compare);

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OtpService(prisma);
  });

  describe('create()', () => {
    it('should generate a 6-digit code', async () => {
      bcryptHash.mockResolvedValue('hashed-code' as never);
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({});

      const code = await service.create('user-1', 'REGISTER_VERIFY');

      expect(code).toMatch(/^\d{6}$/);
    });

    it('should invalidate previous OTPs of the same type', async () => {
      bcryptHash.mockResolvedValue('hashed' as never);
      prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.otpCode.create.mockResolvedValue({});

      await service.create('user-1', 'REGISTER_VERIFY');

      expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', type: 'REGISTER_VERIFY', usedAt: null },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      });
    });

    it('should store the hash, not the plain code', async () => {
      bcryptHash.mockResolvedValue('bcrypt-hash' as never);
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({});

      const plainCode = await service.create('user-1', 'REGISTER_VERIFY');

      expect(prisma.otpCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'bcrypt-hash',
          userId: 'user-1',
          type: 'REGISTER_VERIFY',
        }),
      });
      expect(plainCode).not.toBe('bcrypt-hash');
    });
  });

  describe('verify()', () => {
    const validOtp = {
      id: 'otp-1',
      userId: 'user-1',
      code: 'hashed-code',
      type: 'REGISTER_VERIFY',
      expiresAt: new Date(Date.now() + 600_000),
      usedAt: null,
      createdAt: new Date(),
    };

    it('should return { valid: true } with correct code', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(validOtp);
      bcryptCompare.mockResolvedValue(true as never);
      prisma.otpCode.update.mockResolvedValue({});

      const result = await service.verify(
        'user-1',
        '123456',
        'REGISTER_VERIFY',
      );

      expect(result).toEqual({ valid: true });
    });

    it('should mark OTP as used after successful verification', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(validOtp);
      bcryptCompare.mockResolvedValue(true as never);
      prisma.otpCode.update.mockResolvedValue({});

      await service.verify('user-1', '123456', 'REGISTER_VERIFY');

      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('should return expired when expiresAt < now', async () => {
      prisma.otpCode.findFirst.mockResolvedValue({
        ...validOtp,
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await service.verify(
        'user-1',
        '123456',
        'REGISTER_VERIFY',
      );

      expect(result).toEqual({ valid: false, reason: 'expired' });
    });

    it('should return invalid with wrong code', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(validOtp);
      bcryptCompare.mockResolvedValue(false as never);

      const result = await service.verify(
        'user-1',
        '000000',
        'REGISTER_VERIFY',
      );

      expect(result).toEqual({ valid: false, reason: 'invalid' });
    });

    it('should return not_found when no OTP exists', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);

      const result = await service.verify(
        'user-1',
        '123456',
        'REGISTER_VERIFY',
      );

      expect(result).toEqual({ valid: false, reason: 'not_found' });
    });

    it('should return too_many_attempts after 5 failed tries', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(validOtp);
      bcryptCompare.mockResolvedValue(false as never);
      prisma.otpCode.update.mockResolvedValue({});

      for (let i = 0; i < 4; i++) {
        await service.verify('user-1', '000000', 'REGISTER_VERIFY');
      }

      const result = await service.verify(
        'user-1',
        '000000',
        'REGISTER_VERIFY',
      );

      expect(result).toEqual({ valid: false, reason: 'too_many_attempts' });
      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });
});
