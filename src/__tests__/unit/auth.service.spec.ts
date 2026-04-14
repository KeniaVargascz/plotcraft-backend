import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../modules/auth/auth.service';
import { createProfileFixture, createUserFixture } from '../helpers/fixtures.helper';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    profile: {
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const usersService = {
    toUserEntity: jest.fn((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
    })),
    findByIdOrFail: jest.fn(),
    getCurrentUser: jest.fn(),
  } as any;

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as any;

  const configService = {
    getOrThrow: jest.fn((key: string) => key),
    get: jest.fn((_key: string, fallback: string) => fallback),
  } as any;

  let service: AuthService;
  const bcryptHash = jest.mocked(bcrypt.hash);
  const bcryptCompare = jest.mocked(bcrypt.compare);

  beforeEach(() => {
    jest.clearAllMocks();
    bcryptHash.mockReset();
    bcryptCompare.mockReset();
    const otpService = { create: jest.fn(), verify: jest.fn() } as any;
    const emailService = { sendOtpVerification: jest.fn(), sendWelcome: jest.fn() } as any;
    service = new AuthService(prisma, usersService, jwtService, configService, otpService, emailService);
  });

  it('login throws UnauthorizedException when password does not match', async () => {
    prisma.user.findUnique.mockResolvedValue(createUserFixture());
    bcryptCompare.mockResolvedValue(false as never);

    await expect(
      service.login({
        identifier: 'test@test.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh revokes previous refresh token and returns a new session', async () => {
    const user = createUserFixture({ profile: createProfileFixture() });
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      username: user.username,
      email: user.email,
    });
    usersService.findByIdOrFail.mockResolvedValue(user);
    prisma.refreshToken.findMany
      .mockResolvedValueOnce([
        {
          id: 'refresh-id',
          tokenHash: 'stored-hash',
          expiresAt: new Date(Date.now() + 60_000),
          revoked: false,
        },
      ])
      .mockResolvedValueOnce([]);
    bcryptCompare.mockResolvedValueOnce(true as never);
    bcryptHash.mockResolvedValue('next-hash' as never);
    jwtService.signAsync.mockResolvedValueOnce('access-2');
    jwtService.signAsync.mockResolvedValueOnce('refresh-2');

    const result = await service.refresh({ refreshToken: 'raw-token' });

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'refresh-id' },
      data: { revoked: true },
    });
    expect(result.refreshToken).toBe('refresh-2');
  });
});
