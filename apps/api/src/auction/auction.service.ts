import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuctionStatus, AuctionLotStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { AddLotsDto } from './dto/add-lots.dto';
import { SellLotDto } from './dto/sell-lot.dto';

@Injectable()
export class AuctionService {
  constructor(private prisma: PrismaService) {}

  // ── Org helpers ─────────────────────────────────────────────────────────

  async getOrgId(userId: string): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!profile?.organizationId)
      throw new ForbiddenException('User is not assigned to an organization');
    return profile.organizationId;
  }

  private async assertAuction(id: string, orgId: string) {
    const auction = await this.prisma.auction.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!auction) throw new NotFoundException(`Auction ${id} not found`);
    return auction;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  async create(dto: CreateAuctionDto, userId: string) {
    const orgId = await this.getOrgId(userId);
    return this.prisma.auction.create({
      data: {
        name: dto.name,
        format: dto.format,
        purseSizePerTeam: new Decimal(dto.purseSizePerTeam),
        maxSquadSize: dto.maxSquadSize,
        maxOverseasPerSquad: dto.maxOverseasPerSquad,
        organizationId: orgId,
        createdById: userId,
      },
    });
  }

  async findAll(userId: string) {
    const orgId = await this.getOrgId(userId);
    return this.prisma.auction.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { auctionTeams: true, auctionLots: true } },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.prisma.auction.findFirst({
      where: { id, organizationId: orgId },
      include: {
        auctionTeams: {
          include: { team: { select: { id: true, name: true, shortName: true, primaryColor: true } } },
          orderBy: { team: { name: 'asc' } },
        },
      },
    });
    if (!auction) throw new NotFoundException(`Auction ${id} not found`);

    const currentLot = await this.prisma.auctionLot.findFirst({
      where: { auctionId: id, status: AuctionLotStatus.IN_PROGRESS },
      include: {
        player: true,
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
          include: { auctionTeam: { include: { team: { select: { name: true } } } } },
        },
      },
    });

    const lotCounts = await this.prisma.auctionLot.groupBy({
      by: ['status'],
      where: { auctionId: id },
      _count: true,
    });

    return { ...auction, currentLot, lotCounts };
  }

  // ── Teams ────────────────────────────────────────────────────────────────

  async addTeam(auctionId: string, teamId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.assertAuction(auctionId, orgId);
    if (auction.status !== AuctionStatus.DRAFT)
      throw new BadRequestException('Teams can only be added to DRAFT auctions');

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, OR: [{ organizationId: orgId }, { organizationId: null }] },
    });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);

    return this.prisma.auctionTeam.create({
      data: {
        auctionId,
        teamId,
        remainingPurse: auction.purseSizePerTeam,
      },
      include: { team: true },
    });
  }

  async removeTeam(auctionId: string, auctionTeamId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.assertAuction(auctionId, orgId);
    if (auction.status !== AuctionStatus.DRAFT)
      throw new BadRequestException('Teams can only be removed from DRAFT auctions');

    return this.prisma.auctionTeam.delete({
      where: { id: auctionTeamId, auctionId },
    });
  }

  // ── Lots ────────────────────────────────────────────────────────────────

  async addLots(auctionId: string, dto: AddLotsDto, userId: string) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.assertAuction(auctionId, orgId);
    if (auction.status !== AuctionStatus.DRAFT)
      throw new BadRequestException('Lots can only be added to DRAFT auctions');

    // Get the next lot number
    const lastLot = await this.prisma.auctionLot.findFirst({
      where: { auctionId },
      orderBy: { lotNumber: 'desc' },
    });
    let nextLotNumber = (lastLot?.lotNumber ?? 0) + 1;

    const data: Prisma.AuctionLotCreateManyInput[] = dto.playerIds.map((playerId) => ({
      auctionId,
      playerId,
      lotNumber: nextLotNumber++,
    }));

    await this.prisma.auctionLot.createMany({ data, skipDuplicates: true });
    return this.prisma.auctionLot.findMany({
      where: { auctionId },
      include: { player: true },
      orderBy: { lotNumber: 'asc' },
    });
  }

  async getLots(auctionId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    await this.assertAuction(auctionId, orgId);
    return this.prisma.auctionLot.findMany({
      where: { auctionId },
      include: {
        player: true,
        soldToTeam: { include: { team: { select: { name: true } } } },
      },
      orderBy: { lotNumber: 'asc' },
    });
  }

  async removeLot(auctionId: string, lotId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.assertAuction(auctionId, orgId);
    if (auction.status !== AuctionStatus.DRAFT)
      throw new BadRequestException('Lots can only be removed from DRAFT auctions');

    const lot = await this.prisma.auctionLot.findFirst({ where: { id: lotId, auctionId } });
    if (!lot) throw new NotFoundException(`Lot ${lotId} not found`);

    return this.prisma.auctionLot.delete({ where: { id: lotId } });
  }

  // ── State machine ────────────────────────────────────────────────────────

  async start(auctionId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.assertAuction(auctionId, orgId);
    if (auction.status !== AuctionStatus.DRAFT)
      throw new BadRequestException('Only DRAFT auctions can be started');

    const [teamCount, lotCount] = await Promise.all([
      this.prisma.auctionTeam.count({ where: { auctionId } }),
      this.prisma.auctionLot.count({ where: { auctionId } }),
    ]);
    if (teamCount < 2) throw new BadRequestException('Need at least 2 teams to start');
    if (lotCount < 1) throw new BadRequestException('Need at least 1 player lot to start');

    return this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: AuctionStatus.LIVE, startedAt: new Date() },
    });
  }

  async pause(auctionId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.assertAuction(auctionId, orgId);
    if (auction.status !== AuctionStatus.LIVE)
      throw new BadRequestException('Only LIVE auctions can be paused');
    return this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: AuctionStatus.PAUSED },
    });
  }

  async resume(auctionId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.assertAuction(auctionId, orgId);
    if (auction.status !== AuctionStatus.PAUSED)
      throw new BadRequestException('Only PAUSED auctions can be resumed');
    return this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: AuctionStatus.LIVE },
    });
  }

  // ── Lot progression ──────────────────────────────────────────────────────

  async startNextLot(auctionId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.assertAuction(auctionId, orgId);
    if (auction.status !== AuctionStatus.LIVE)
      throw new BadRequestException('Auction must be LIVE to start a lot');

    const active = await this.prisma.auctionLot.findFirst({
      where: { auctionId, status: AuctionLotStatus.IN_PROGRESS },
    });
    if (active) throw new BadRequestException('A lot is already in progress');

    const next = await this.prisma.auctionLot.findFirst({
      where: { auctionId, status: AuctionLotStatus.PENDING },
      orderBy: { lotNumber: 'asc' },
      include: { player: true },
    });
    if (!next) throw new BadRequestException('No more pending lots');

    const lot = await this.prisma.auctionLot.update({
      where: { id: next.id },
      data: { status: AuctionLotStatus.IN_PROGRESS },
      include: { player: true },
    });
    return lot;
  }

  async sellLot(auctionId: string, lotId: string, dto: SellLotDto, userId: string) {
    const orgId = await this.getOrgId(userId);
    await this.assertAuction(auctionId, orgId);

    // Serialize concurrent sell/bid attempts on this lot by locking its row,
    // so two simultaneous "Sell" calls can't both see IN_PROGRESS and both commit.
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "AuctionLot" WHERE id = ${lotId} FOR UPDATE`;

      const lot = await tx.auctionLot.findFirst({
        where: { id: lotId, auctionId, status: AuctionLotStatus.IN_PROGRESS },
        include: { player: true },
      });
      if (!lot) throw new NotFoundException('No active lot found');

      const team = await tx.auctionTeam.findFirst({
        where: { id: dto.auctionTeamId, auctionId },
        include: {
          wonLots: { include: { player: true } },
          team: true,
        },
      });
      if (!team) throw new NotFoundException('AuctionTeam not found');

      // Price is derived from the recorded bids, never trusted from the client.
      const highestBid = await tx.bid.findFirst({
        where: { auctionLotId: lotId },
        orderBy: { amount: 'desc' },
      });
      if (highestBid && highestBid.auctionTeamId !== dto.auctionTeamId)
        throw new BadRequestException('Sold team must match the highest bidder');
      const price = highestBid ? highestBid.amount : lot.player.basePrice;

      if (price.gt(team.remainingPurse))
        throw new BadRequestException('Team has insufficient purse');

      const auction = await tx.auction.findUniqueOrThrow({
        where: { id: auctionId },
      });
      if (team.playersAcquired >= auction.maxSquadSize)
        throw new BadRequestException('Team has reached max squad size');
      if (lot.player.isOverseas && team.overseasAcquired >= auction.maxOverseasPerSquad)
        throw new BadRequestException('Team has reached max overseas quota');

      const updatedLot = await tx.auctionLot.update({
        where: { id: lotId },
        data: {
          status: AuctionLotStatus.SOLD,
          soldToTeamId: dto.auctionTeamId,
          soldPrice: price,
        },
        include: { player: true, soldToTeam: { include: { team: true } } },
      });
      await tx.auctionTeam.update({
        where: { id: dto.auctionTeamId },
        data: {
          remainingPurse: { decrement: price },
          playersAcquired: { increment: 1 },
          overseasAcquired: lot.player.isOverseas ? { increment: 1 } : undefined,
        },
      });

      return updatedLot;
    });
  }

  async unsoldLot(auctionId: string, lotId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    await this.assertAuction(auctionId, orgId);

    const lot = await this.prisma.auctionLot.findFirst({
      where: { id: lotId, auctionId, status: AuctionLotStatus.IN_PROGRESS },
    });
    if (!lot) throw new NotFoundException('No active lot found');

    return this.prisma.auctionLot.update({
      where: { id: lotId },
      data: { status: AuctionLotStatus.UNSOLD },
      include: { player: true },
    });
  }

  // ── Bidding ──────────────────────────────────────────────────────────────

  async placeBid(
    auctionId: string,
    lotId: string,
    auctionTeamId: string,
    amount: number,
    userId: string,
  ) {
    const orgId = await this.getOrgId(userId);
    const auction = await this.assertAuction(auctionId, orgId);

    if (auction.status !== AuctionStatus.LIVE)
      throw new BadRequestException('Auction is not live');

    const bidAmount = new Decimal(amount);

    // Serialize concurrent bids on this lot: lock its row for the duration of
    // the transaction so two simultaneous bids can't both read the same
    // "current highest" and both be accepted.
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "AuctionLot" WHERE id = ${lotId} FOR UPDATE`;

      const lot = await tx.auctionLot.findFirst({
        where: { id: lotId, auctionId, status: AuctionLotStatus.IN_PROGRESS },
        include: { player: true },
      });
      if (!lot) throw new BadRequestException('No active lot');

      const team = await tx.auctionTeam.findFirst({
        where: { id: auctionTeamId, auctionId },
        include: { team: true },
      });
      if (!team) throw new BadRequestException('Invalid team');

      // Must be at least base price
      if (bidAmount.lt(lot.player.basePrice))
        throw new BadRequestException(`Bid must be at least ${lot.player.basePrice}`);

      // Must exceed current highest bid
      const highest = await tx.bid.findFirst({
        where: { auctionLotId: lotId },
        orderBy: { amount: 'desc' },
      });
      if (highest && bidAmount.lte(highest.amount))
        throw new BadRequestException(`Bid must exceed current high of ${highest.amount}`);

      // Team must have enough purse
      if (bidAmount.gt(team.remainingPurse))
        throw new BadRequestException('Insufficient purse');

      const bid = await tx.bid.create({
        data: { auctionLotId: lotId, auctionTeamId, amount: bidAmount },
        include: { auctionTeam: { include: { team: { select: { name: true } } } } },
      });

      return { bid, team };
    });
  }

  async getBidHistory(auctionId: string, lotId: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    await this.assertAuction(auctionId, orgId);
    return this.prisma.bid.findMany({
      where: { auctionLotId: lotId },
      include: { auctionTeam: { include: { team: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
