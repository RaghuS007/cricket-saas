import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PrismaService } from '../prisma.service';

describe('PlayersService', () => {
  let service: PlayersService;
  let prisma: {
    userProfile: { findUnique: jest.Mock };
    player: { findMany: jest.Mock; create: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    auctionLot: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      userProfile: { findUnique: jest.fn() },
      player: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
      auctionLot: { count: jest.fn() },
      // The service runs remove() inside $transaction(tx => ...) — running the
      // callback against the same mock stands in for Prisma's tx client.
      $transaction: jest.fn((cb) => cb(prisma)),
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

  describe('updatePhoto', () => {
    it('sets the photoUrl on a player that belongs to the caller organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findFirst.mockResolvedValue({ id: 'p-1', organizationId: 'org-1', photoUrl: null });
      prisma.player.update.mockResolvedValue({ id: 'p-1', photoUrl: '/uploads/player-photos/new.png' });

      await service.updatePhoto('p-1', '/uploads/player-photos/new.png', 'user-1');

      expect(prisma.player.findFirst.mock.calls[0][0].where).toEqual({ id: 'p-1', organizationId: 'org-1' });
      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { photoUrl: '/uploads/player-photos/new.png' },
      });
    });

    it('rejects uploading a photo for a global (organizationId: null) reference player', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePhoto('global-player', '/uploads/player-photos/new.png', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.player.update).not.toHaveBeenCalled();
    });

    it("rejects uploading a photo for another organization's player (IDOR)", async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePhoto('victim-player', '/uploads/player-photos/new.png', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.player.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a player that belongs to the caller organization and is unused', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findFirst.mockResolvedValue({ id: 'p-1', organizationId: 'org-1', name: 'Player' });
      prisma.auctionLot.count.mockResolvedValue(0);
      prisma.player.delete.mockResolvedValue({ id: 'p-1', name: 'Player' });

      const result = await service.remove('p-1', 'user-1');

      expect(prisma.player.findFirst.mock.calls[0][0].where).toEqual({ id: 'p-1', organizationId: 'org-1' });
      expect(prisma.auctionLot.count).toHaveBeenCalledWith({ where: { playerId: 'p-1' } });
      expect(prisma.player.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
      expect(result).toEqual({ id: 'p-1', name: 'Player' });
    });

    it('rejects deleting a player that still appears in an auction lot (e.g. already sold)', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findFirst.mockResolvedValue({ id: 'p-1', organizationId: 'org-1', name: 'Player' });
      prisma.auctionLot.count.mockResolvedValue(1);

      await expect(service.remove('p-1', 'user-1')).rejects.toThrow(ConflictException);
      expect(prisma.player.delete).not.toHaveBeenCalled();
    });

    it('rejects deleting a global (organizationId: null) reference player', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findFirst.mockResolvedValue(null);

      await expect(service.remove('global-player', 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.player.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting another organization's player (IDOR)", async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      prisma.player.findFirst.mockResolvedValue(null);

      await expect(service.remove('victim-player', 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.player.delete).not.toHaveBeenCalled();
    });
  });
});
