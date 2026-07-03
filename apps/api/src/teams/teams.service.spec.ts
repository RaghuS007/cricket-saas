import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma.service';

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: {
    userProfile: { findUnique: jest.Mock };
    team: { findMany: jest.Mock; create: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    auctionTeam: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      userProfile: { findUnique: jest.fn() },
      team: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
      auctionTeam: { count: jest.fn() },
      // The service runs remove() inside $transaction(tx => ...) — running the
      // callback against the same mock stands in for Prisma's tx client.
      $transaction: jest.fn((cb) => cb(prisma)),
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

  describe('updateLogo', () => {
    it('sets the logoUrl on a team that belongs to the caller organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue({ id: 't-1', organizationId: 'org-1', logoUrl: null });
      prisma.team.update.mockResolvedValue({ id: 't-1', logoUrl: '/uploads/team-logos/new.png' });

      await service.updateLogo('t-1', '/uploads/team-logos/new.png', 'user-1');

      expect(prisma.team.findFirst.mock.calls[0][0].where).toEqual({ id: 't-1', organizationId: 'org-1' });
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { logoUrl: '/uploads/team-logos/new.png' },
      });
    });

    it('rejects uploading a logo for a global (organizationId: null) seed team', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.updateLogo('csk-global-id', '/uploads/team-logos/new.png', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it("rejects uploading a logo for another organization's team (IDOR)", async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.updateLogo('victim-team', '/uploads/team-logos/new.png', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.team.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a team that belongs to the caller organization and is unused', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue({ id: 't-1', organizationId: 'org-1', name: 'FC', logoUrl: null });
      prisma.auctionTeam.count.mockResolvedValue(0);
      prisma.team.delete.mockResolvedValue({ id: 't-1', name: 'FC', logoUrl: null });

      const result = await service.remove('t-1', 'user-1');

      expect(prisma.team.findFirst.mock.calls[0][0].where).toEqual({ id: 't-1', organizationId: 'org-1' });
      expect(prisma.auctionTeam.count).toHaveBeenCalledWith({ where: { teamId: 't-1' } });
      expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: 't-1' } });
      expect(result).toEqual({ id: 't-1', name: 'FC', logoUrl: null });
    });

    it('rejects deleting a team that is still used in an auction', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue({ id: 't-1', organizationId: 'org-1', name: 'FC', logoUrl: null });
      prisma.auctionTeam.count.mockResolvedValue(2);

      await expect(service.remove('t-1', 'user-1')).rejects.toThrow(ConflictException);
      expect(prisma.team.delete).not.toHaveBeenCalled();
    });

    it('rejects deleting a global (organizationId: null) seed team', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(service.remove('csk-global-id', 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.team.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting another organization's team (IDOR)", async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(service.remove('victim-team', 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.team.delete).not.toHaveBeenCalled();
    });
  });
});
