import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { AuctionStatus, AuctionLotStatus } from '@prisma/client';
import { AuctionService } from './auction.service';
import { PrismaService } from '../prisma.service';

function makePrismaMock() {
  const prisma: any = {
    userProfile: { findUnique: jest.fn() },
    auction: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    auctionTeam: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auctionLot: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    bid: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    team: { findFirst: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return prisma;
}

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const AUCTION_ID = 'auction-1';

describe('AuctionService', () => {
  let service: AuctionService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AuctionService(prisma as unknown as PrismaService);
    prisma.userProfile.findUnique.mockResolvedValue({ organizationId: ORG_ID });
  });

  describe('getOrgId', () => {
    it('throws if the user has no organization', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ organizationId: null });
      await expect(service.getOrgId(USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('scopes the auction to the caller organization', async () => {
      prisma.auction.create.mockResolvedValue({ id: AUCTION_ID });
      await service.create(
        { name: 'IPL 2026', format: 'T20' as never, purseSizePerTeam: 1000, maxSquadSize: 15, maxOverseasPerSquad: 4 },
        USER_ID,
      );
      expect(prisma.auction.create.mock.calls[0][0].data.organizationId).toBe(ORG_ID);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a foreign or nonexistent auction', async () => {
      prisma.auction.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nope', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addTeam', () => {
    it('rejects when the auction is not DRAFT', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
      await expect(service.addTeam(AUCTION_ID, 'team-1', USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown team id', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.DRAFT });
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(service.addTeam(AUCTION_ID, 'bogus-team', USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('adds the team with the auction purse as its starting purse', async () => {
      prisma.auction.findFirst.mockResolvedValue({
        id: AUCTION_ID,
        status: AuctionStatus.DRAFT,
        purseSizePerTeam: new Decimal(1_000_000),
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'team-1' });
      prisma.auctionTeam.create.mockResolvedValue({ id: 'at-1' });

      await service.addTeam(AUCTION_ID, 'team-1', USER_ID);
      expect(prisma.auctionTeam.create.mock.calls[0][0].data.remainingPurse).toEqual(new Decimal(1_000_000));
    });
  });

  describe('removeTeam', () => {
    it('rejects when the auction is not DRAFT', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
      await expect(service.removeTeam(AUCTION_ID, 'at-1', USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('start', () => {
    it('requires at least 2 teams', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.DRAFT });
      prisma.auctionTeam.count.mockResolvedValue(1);
      prisma.auctionLot.count.mockResolvedValue(5);
      await expect(service.start(AUCTION_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('requires at least 1 lot', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.DRAFT });
      prisma.auctionTeam.count.mockResolvedValue(2);
      prisma.auctionLot.count.mockResolvedValue(0);
      await expect(service.start(AUCTION_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects starting a non-DRAFT auction', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
      await expect(service.start(AUCTION_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('transitions DRAFT -> LIVE when requirements are met', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.DRAFT });
      prisma.auctionTeam.count.mockResolvedValue(2);
      prisma.auctionLot.count.mockResolvedValue(1);
      prisma.auction.update.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });

      await service.start(AUCTION_ID, USER_ID);
      expect(prisma.auction.update.mock.calls[0][0].data.status).toBe(AuctionStatus.LIVE);
    });
  });

  describe('pause / resume', () => {
    it('rejects pausing a non-LIVE auction', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.DRAFT });
      await expect(service.pause(AUCTION_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects resuming a non-PAUSED auction', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
      await expect(service.resume(AUCTION_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('startNextLot', () => {
    it('rejects when auction is not LIVE', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.DRAFT });
      await expect(service.startNextLot(AUCTION_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects when a lot is already in progress', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
      prisma.auctionLot.findFirst.mockResolvedValueOnce({ id: 'lot-active' });
      await expect(service.startNextLot(AUCTION_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects when there are no pending lots left', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
      prisma.auctionLot.findFirst.mockResolvedValueOnce(null); // no active lot
      prisma.auctionLot.findFirst.mockResolvedValueOnce(null); // no pending lot
      await expect(service.startNextLot(AUCTION_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('placeBid', () => {
    const LOT_ID = 'lot-1';
    const TEAM_ID = 'at-1';

    beforeEach(() => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
    });

    it('rejects when the auction is not LIVE', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.PAUSED });
      await expect(service.placeBid(AUCTION_ID, LOT_ID, TEAM_ID, 100, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects when there is no active lot', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue(null);
      await expect(service.placeBid(AUCTION_ID, LOT_ID, TEAM_ID, 100, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown team', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player: { basePrice: new Decimal(100) } });
      prisma.auctionTeam.findFirst.mockResolvedValue(null);
      await expect(service.placeBid(AUCTION_ID, LOT_ID, TEAM_ID, 100, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects a bid below base price', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player: { basePrice: new Decimal(1000) } });
      prisma.auctionTeam.findFirst.mockResolvedValue({ id: TEAM_ID, remainingPurse: new Decimal(1_000_000) });
      await expect(service.placeBid(AUCTION_ID, LOT_ID, TEAM_ID, 500, USER_ID)).rejects.toThrow(
        /at least/,
      );
    });

    it('rejects a bid that does not exceed the current highest', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player: { basePrice: new Decimal(100) } });
      prisma.auctionTeam.findFirst.mockResolvedValue({ id: TEAM_ID, remainingPurse: new Decimal(1_000_000) });
      prisma.bid.findFirst.mockResolvedValue({ amount: new Decimal(500) });
      await expect(service.placeBid(AUCTION_ID, LOT_ID, TEAM_ID, 500, USER_ID)).rejects.toThrow(/exceed/);
      await expect(service.placeBid(AUCTION_ID, LOT_ID, TEAM_ID, 400, USER_ID)).rejects.toThrow(/exceed/);
    });

    it('rejects a bid the team cannot afford', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player: { basePrice: new Decimal(100) } });
      prisma.auctionTeam.findFirst.mockResolvedValue({ id: TEAM_ID, remainingPurse: new Decimal(200) });
      prisma.bid.findFirst.mockResolvedValue(null);
      await expect(service.placeBid(AUCTION_ID, LOT_ID, TEAM_ID, 500, USER_ID)).rejects.toThrow(/purse/i);
    });

    it('accepts a valid bid', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player: { basePrice: new Decimal(100) } });
      prisma.auctionTeam.findFirst.mockResolvedValue({ id: TEAM_ID, remainingPurse: new Decimal(1_000_000), team: {} });
      prisma.bid.findFirst.mockResolvedValue(null);
      prisma.bid.create.mockResolvedValue({ id: 'bid-1', amount: new Decimal(500) });

      const result = await service.placeBid(AUCTION_ID, LOT_ID, TEAM_ID, 500, USER_ID);
      expect(result.bid.id).toBe('bid-1');
      expect(prisma.$executeRaw).toHaveBeenCalled(); // row-lock taken
    });

    it('rejects a zero or negative amount at the numeric boundary (service level)', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player: { basePrice: new Decimal(0) } });
      prisma.auctionTeam.findFirst.mockResolvedValue({ id: TEAM_ID, remainingPurse: new Decimal(1_000_000) });
      prisma.bid.findFirst.mockResolvedValue({ amount: new Decimal(0) });
      // Even if base price is 0, a bid of 0 can't exceed an existing 0 bid.
      await expect(service.placeBid(AUCTION_ID, LOT_ID, TEAM_ID, 0, USER_ID)).rejects.toThrow(/exceed/);
    });
  });

  describe('sellLot', () => {
    const LOT_ID = 'lot-1';
    const TEAM_ID = 'at-1';
    const player = { basePrice: new Decimal(1000), isOverseas: false };

    beforeEach(() => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
    });

    it('throws when there is no active lot', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue(null);
      await expect(service.sellLot(AUCTION_ID, LOT_ID, { auctionTeamId: TEAM_ID }, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws for an unknown team', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player });
      prisma.auctionTeam.findFirst.mockResolvedValue(null);
      await expect(service.sellLot(AUCTION_ID, LOT_ID, { auctionTeamId: TEAM_ID }, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sells at base price when there were no bids', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player });
      prisma.auctionTeam.findFirst.mockResolvedValue({
        id: TEAM_ID,
        remainingPurse: new Decimal(1_000_000),
        playersAcquired: 0,
        overseasAcquired: 0,
      });
      prisma.bid.findFirst.mockResolvedValue(null);
      prisma.auction.findUniqueOrThrow.mockResolvedValue({ maxSquadSize: 15, maxOverseasPerSquad: 4 });
      prisma.auctionLot.update.mockResolvedValue({ id: LOT_ID, soldPrice: player.basePrice });

      await service.sellLot(AUCTION_ID, LOT_ID, { auctionTeamId: TEAM_ID }, USER_ID);
      const updateData = prisma.auctionLot.update.mock.calls[0][0].data;
      expect(updateData.soldPrice).toEqual(player.basePrice);
    });

    it('sells at the highest recorded bid, ignoring any client-supplied price', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player });
      prisma.auctionTeam.findFirst.mockResolvedValue({
        id: TEAM_ID,
        remainingPurse: new Decimal(1_000_000),
        playersAcquired: 0,
        overseasAcquired: 0,
      });
      prisma.bid.findFirst.mockResolvedValue({ amount: new Decimal(5000), auctionTeamId: TEAM_ID });
      prisma.auction.findUniqueOrThrow.mockResolvedValue({ maxSquadSize: 15, maxOverseasPerSquad: 4 });
      prisma.auctionLot.update.mockResolvedValue({ id: LOT_ID });

      await service.sellLot(
        AUCTION_ID,
        LOT_ID,
        // @ts-expect-error soldPrice no longer exists on the DTO — simulates a stale/malicious client still sending one
        { auctionTeamId: TEAM_ID, soldPrice: 1 },
        USER_ID,
      );
      const updateData = prisma.auctionLot.update.mock.calls[0][0].data;
      expect(updateData.soldPrice).toEqual(new Decimal(5000)); // the recorded bid, not the smuggled "1"
    });

    it('rejects selling to a team that is not the highest bidder', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player });
      prisma.auctionTeam.findFirst.mockResolvedValue({
        id: TEAM_ID,
        remainingPurse: new Decimal(1_000_000),
        playersAcquired: 0,
        overseasAcquired: 0,
      });
      prisma.bid.findFirst.mockResolvedValue({ amount: new Decimal(5000), auctionTeamId: 'at-someone-else' });

      await expect(service.sellLot(AUCTION_ID, LOT_ID, { auctionTeamId: TEAM_ID }, USER_ID)).rejects.toThrow(
        /highest bidder/,
      );
    });

    it('rejects when the team cannot afford the price', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player });
      prisma.auctionTeam.findFirst.mockResolvedValue({
        id: TEAM_ID,
        remainingPurse: new Decimal(10),
        playersAcquired: 0,
        overseasAcquired: 0,
      });
      prisma.bid.findFirst.mockResolvedValue(null); // sells at base price 1000 > purse 10
      await expect(service.sellLot(AUCTION_ID, LOT_ID, { auctionTeamId: TEAM_ID }, USER_ID)).rejects.toThrow(
        /purse/i,
      );
    });

    it('rejects when the team has reached max squad size', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player });
      prisma.auctionTeam.findFirst.mockResolvedValue({
        id: TEAM_ID,
        remainingPurse: new Decimal(1_000_000),
        playersAcquired: 15,
        overseasAcquired: 0,
      });
      prisma.bid.findFirst.mockResolvedValue(null);
      prisma.auction.findUniqueOrThrow.mockResolvedValue({ maxSquadSize: 15, maxOverseasPerSquad: 4 });
      await expect(service.sellLot(AUCTION_ID, LOT_ID, { auctionTeamId: TEAM_ID }, USER_ID)).rejects.toThrow(
        /squad size/,
      );
    });

    it('rejects when the team has reached the overseas quota for an overseas player', async () => {
      prisma.auctionLot.findFirst.mockResolvedValue({ id: LOT_ID, player: { ...player, isOverseas: true } });
      prisma.auctionTeam.findFirst.mockResolvedValue({
        id: TEAM_ID,
        remainingPurse: new Decimal(1_000_000),
        playersAcquired: 0,
        overseasAcquired: 4,
      });
      prisma.bid.findFirst.mockResolvedValue(null);
      prisma.auction.findUniqueOrThrow.mockResolvedValue({ maxSquadSize: 15, maxOverseasPerSquad: 4 });
      await expect(service.sellLot(AUCTION_ID, LOT_ID, { auctionTeamId: TEAM_ID }, USER_ID)).rejects.toThrow(
        /overseas/,
      );
    });
  });

  describe('unsoldLot', () => {
    it('throws when there is no active lot', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
      prisma.auctionLot.findFirst.mockResolvedValue(null);
      await expect(service.unsoldLot(AUCTION_ID, 'lot-1', USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('marks the lot UNSOLD', async () => {
      prisma.auction.findFirst.mockResolvedValue({ id: AUCTION_ID, status: AuctionStatus.LIVE });
      prisma.auctionLot.findFirst.mockResolvedValue({ id: 'lot-1' });
      prisma.auctionLot.update.mockResolvedValue({ id: 'lot-1', status: AuctionLotStatus.UNSOLD });

      await service.unsoldLot(AUCTION_ID, 'lot-1', USER_ID);
      expect(prisma.auctionLot.update.mock.calls[0][0].data.status).toBe(AuctionLotStatus.UNSOLD);
    });
  });
});
