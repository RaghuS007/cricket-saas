import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { userProfile: { findUnique: jest.Mock; create: jest.Mock } };
  let config: ConfigService;

  beforeEach(() => {
    prisma = {
      userProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    config = { getOrThrow: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    service = new AuthService(prisma as unknown as PrismaService, config);
  });

  describe('register', () => {
    it('creates a user and returns an access token', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      prisma.userProfile.create.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash: 'hashed',
      });

      const result = await service.register('a@example.com', 'password123', 'Alice');

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.user).toEqual({ id: 'user-1', email: 'a@example.com' });
      const createArgs = prisma.userProfile.create.mock.calls[0][0];
      expect(createArgs.data.email).toBe('a@example.com');
      expect(createArgs.data.passwordHash).not.toBe('password123'); // must be hashed, not stored raw
    });

    it('rejects a duplicate email', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.register('a@example.com', 'password123')).rejects.toThrow(ConflictException);
      expect(prisma.userProfile.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns an access token for correct credentials', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      prisma.userProfile.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash,
      });

      const result = await service.login('a@example.com', 'correct-password');
      expect(result.accessToken).toEqual(expect.any(String));
    });

    it('rejects an unknown email', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      await expect(service.login('nobody@example.com', 'x')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password without leaking whether the email exists', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      prisma.userProfile.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com', passwordHash });

      await expect(service.login('a@example.com', 'wrong-password')).rejects.toThrow(UnauthorizedException);
    });
  });
});
