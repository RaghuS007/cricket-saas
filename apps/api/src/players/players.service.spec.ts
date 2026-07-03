import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PrismaService } from '../prisma.service';

describe('PlayersService', () => {
  let service: PlayersService;
  let prisma: {
    userProfile: { findUnique: jest.Mock };
    player: { findMany: jest.Mock; create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      userProfile: { findUnique: jest.fn() },
      player: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    service = new PlayersService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('includes global players even with no organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      prisma.player.findMany.mockResolvedValue([]);

      await service.findAll('user-1');

      const where = prisma.player.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ organizationId: null }]);
    });

    it('includes both global and org-scoped players when the user has an org', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findMany.mockResolvedValue([]);

      await service.findAll('user-1');

      const where = prisma.player.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ organizationId: null }, { organizationId: 'org-1' }]);
    });
  });

  describe('create', () => {
    it('scopes the new player to the caller organization, ignoring any client-supplied org', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.create.mockResolvedValue({ id: 'p-1' });

      await service.create(
        // @ts-expect-error organizationId isn't a real field on the DTO anymore — this simulates a client trying to smuggle one in via a loosely-typed caller
        { name: 'Sneaky', role: 'BAT', basePrice: 100, organizationId: 'org-victim' },
        'user-1',
      );

      const data = prisma.player.create.mock.calls[0][0].data;
      expect(data.organizationId).toBe('org-1'); // caller's real org, not the spoofed one
    });

    it('rejects creation when the caller has no organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ name: 'X', role: 'BAT' as never, basePrice: 100 }, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.player.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a player that belongs to the caller organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findFirst.mockResolvedValue({ id: 'p-1', organizationId: 'org-1' });
      prisma.player.update.mockResolvedValue({ id: 'p-1', name: 'Updated' });

      await service.update('p-1', { name: 'Updated' }, 'user-1');

      expect(prisma.player.findFirst.mock.calls[0][0].where).toEqual({ id: 'p-1', organizationId: 'org-1' });
      expect(prisma.player.update).toHaveBeenCalledWith({ where: { id: 'p-1' }, data: { name: 'Updated' } });
    });

    it('rejects editing a global (organizationId: null) reference player', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      // findFirst is scoped to organizationId: 'org-1', so a global player never matches.
      prisma.player.findFirst.mockResolvedValue(null);

      await expect(service.update('global-player', { name: 'Hacked' }, 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.player.update).not.toHaveBeenCalled();
    });

    it("rejects editing another organization's player (IDOR)", async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findFirst.mockResolvedValue(null); // scoped query excludes org-victim's player

      await expect(service.update('victim-player', { basePrice: 1 }, 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.player.update).not.toHaveBeenCalled();
    });
  });
});
