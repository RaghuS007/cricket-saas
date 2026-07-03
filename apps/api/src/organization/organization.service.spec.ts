import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../prisma.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: {
    userProfile: { findUnique: jest.Mock; update: jest.Mock };
    organization: { findUnique: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      userProfile: { findUnique: jest.fn(), update: jest.fn() },
      organization: { findUnique: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new OrganizationService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates an org and makes the caller its OWNER', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ id: 'user-1', organizationId: null });
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.organization.create.mockResolvedValue({ id: 'org-1', name: 'My League', slug: 'my-league' });
      prisma.userProfile.update.mockResolvedValue({});

      const result = await service.create({ name: 'My League', slug: 'my-league' }, 'user-1');

      expect(result).toEqual({ id: 'org-1', name: 'My League', slug: 'my-league' });
      expect(prisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', role: 'OWNER' }) }),
      );
    });

    it('rejects if the user profile does not exist', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      await expect(service.create({ name: 'X', slug: 'x' }, 'ghost')).rejects.toThrow(BadRequestException);
    });

    it('rejects if the user already belongs to an organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ id: 'user-1', organizationId: 'org-existing' });
      await expect(service.create({ name: 'X', slug: 'x' }, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('rejects a duplicate slug', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ id: 'user-1', organizationId: null });
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-other', slug: 'taken' });
      await expect(service.create({ name: 'X', slug: 'taken' }, 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('findMine', () => {
    it('returns null when the user has no organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organization: null });
      await expect(service.findMine('user-1')).resolves.toBeNull();
    });

    it('returns null when the user profile does not exist', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      await expect(service.findMine('ghost')).resolves.toBeNull();
    });

    it('returns the organization when present', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organization: { id: 'org-1', name: 'X' } });
      await expect(service.findMine('user-1')).resolves.toEqual({ id: 'org-1', name: 'X' });
    });
  });
});
