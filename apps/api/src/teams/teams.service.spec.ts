import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma.service';

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: {
    userProfile: { findUnique: jest.Mock };
    team: { findMany: jest.Mock; create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      userProfile: { findUnique: jest.fn() },
      team: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    service = new TeamsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('includes only global teams for a user without an organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      prisma.team.findMany.mockResolvedValue([]);

      await service.findAll('user-1');

      const where = prisma.team.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ organizationId: null }]);
    });

    it('includes global and org-scoped teams for a user with an organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findMany.mockResolvedValue([]);

      await service.findAll('user-1');

      const where = prisma.team.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ organizationId: null }, { organizationId: 'org-1' }]);
    });
  });

  describe('create', () => {
    it('scopes the new team to the caller organization, ignoring any client-supplied org', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.create.mockResolvedValue({ id: 't-1' });

      await service.create(
        // @ts-expect-error simulates a client trying to smuggle an organizationId in via a loosely-typed caller
        { name: 'Sneaky FC', shortName: 'SFC', organizationId: 'org-victim' },
        'user-1',
      );

      const data = prisma.team.create.mock.calls[0][0].data;
      expect(data.organizationId).toBe('org-1');
    });

    it('rejects creation when the caller has no organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      await expect(service.create({ name: 'X', shortName: 'X' }, 'user-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.team.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a team that belongs to the caller organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue({ id: 't-1', organizationId: 'org-1' });
      prisma.team.update.mockResolvedValue({ id: 't-1', name: 'Updated FC' });

      await service.update('t-1', { name: 'Updated FC' }, 'user-1');

      expect(prisma.team.findFirst.mock.calls[0][0].where).toEqual({ id: 't-1', organizationId: 'org-1' });
      expect(prisma.team.update).toHaveBeenCalledWith({ where: { id: 't-1' }, data: { name: 'Updated FC' } });
    });

    it('rejects editing a global (organizationId: null) seed team', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(service.update('csk-global-id', { name: 'Hacked' }, 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it("rejects editing another organization's team (IDOR)", async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(service.update('victim-team', { shortName: 'HAX' }, 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.team.update).not.toHaveBeenCalled();
    });
  });
});
