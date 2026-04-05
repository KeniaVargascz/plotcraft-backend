import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../modules/users/users.service';
import { createProfileFixture, createUserFixture } from '../helpers/fixtures.helper';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  let service: UsersService;
  const bcryptHash = jest.mocked(bcrypt.hash);
  const bcryptCompare = jest.mocked(bcrypt.compare);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockReset();
    prisma.user.update.mockReset();
    prisma.user.delete.mockReset();
    bcryptHash.mockReset();
    bcryptCompare.mockReset();
    service = new UsersService(prisma);
  });

  it('updateCurrentUser hashes the new password after validating currentPassword', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(createUserFixture({ profile: createProfileFixture() }))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    bcryptCompare.mockResolvedValue(true as never);
    bcryptHash.mockResolvedValue('new-hash' as never);
    prisma.user.update.mockResolvedValue(
      createUserFixture({
        email: 'next@test.com',
        username: 'nextuser',
        profile: createProfileFixture(),
      }),
    );

    const result = await service.updateCurrentUser('user-id', {
      email: 'next@test.com',
      username: 'nextuser',
      currentPassword: 'Demo1234!',
      newPassword: 'Other1234!',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('Other1234!', 12);
    expect(prisma.user.update).toHaveBeenCalled();
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('updateCurrentUser throws ConflictException when email already exists', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(createUserFixture({ profile: createProfileFixture() }))
      .mockResolvedValueOnce(createUserFixture({ id: 'other-user' }))
      .mockResolvedValueOnce(null);

    await expect(
      service.updateCurrentUser('user-id', {
        email: 'duplicated@test.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deleteCurrentUser throws ForbiddenException when password is invalid', async () => {
    prisma.user.findUnique.mockResolvedValue(
      createUserFixture({ profile: createProfileFixture() }),
    );
    bcryptCompare.mockResolvedValue(false as never);

    await expect(
      service.deleteCurrentUser('user-id', { password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
