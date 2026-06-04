import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { AuctionService } from './auction.service';
import { AuctionGateway } from './auction.gateway';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { AddTeamDto } from './dto/add-team.dto';
import { AddLotsDto } from './dto/add-lots.dto';
import { SellLotDto } from './dto/sell-lot.dto';

@Controller('auctions')
export class AuctionController {
  constructor(
    private readonly auctionService: AuctionService,
    private readonly gateway: AuctionGateway,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  @Post()
  create(@Body() dto: CreateAuctionDto, @CurrentUser() user: AuthUser) {
    return this.auctionService.create(dto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.auctionService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.auctionService.findOne(id, user.id);
  }

  // ── State machine ─────────────────────────────────────────────────────────

  @Post(':id/start')
  async start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const auction = await this.auctionService.start(id, user.id);
    this.gateway.broadcastStatus(id, auction.status);
    return auction;
  }

  @Post(':id/pause')
  async pause(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const auction = await this.auctionService.pause(id, user.id);
    this.gateway.broadcastStatus(id, auction.status);
    return auction;
  }

  @Post(':id/resume')
  async resume(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const auction = await this.auctionService.resume(id, user.id);
    this.gateway.broadcastStatus(id, auction.status);
    return auction;
  }

  // ── Teams ─────────────────────────────────────────────────────────────────

  @Post(':id/teams')
  addTeam(
    @Param('id') id: string,
    @Body() dto: AddTeamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auctionService.addTeam(id, dto.teamId, user.id);
  }

  // ── Lots ──────────────────────────────────────────────────────────────────

  @Post(':id/lots')
  addLots(
    @Param('id') id: string,
    @Body() dto: AddLotsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auctionService.addLots(id, dto, user.id);
  }

  @Get(':id/lots')
  getLots(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.auctionService.getLots(id, user.id);
  }

  @Post(':id/lots/next')
  async startNextLot(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const lot = await this.auctionService.startNextLot(id, user.id);
    this.gateway.broadcastLotStarted(id, {
      id: lot.id,
      lotNumber: lot.lotNumber,
      player: {
        id: lot.player.id,
        name: lot.player.name,
        role: lot.player.role,
        country: lot.player.country,
        basePrice: lot.player.basePrice.toString(),
        isOverseas: lot.player.isOverseas,
      },
    });
    return lot;
  }

  @Post(':id/lots/:lotId/sell')
  async sellLot(
    @Param('id') id: string,
    @Param('lotId') lotId: string,
    @Body() dto: SellLotDto,
    @CurrentUser() user: AuthUser,
  ) {
    const lot = await this.auctionService.sellLot(id, lotId, dto, user.id);
    this.gateway.broadcastLotSold(id, {
      lotId,
      soldPrice: lot.soldPrice!.toString(),
      auctionTeamId: dto.auctionTeamId,
      teamName: lot.soldToTeam!.team.name,
    });
    return lot;
  }

  @Post(':id/lots/:lotId/unsold')
  async unsoldLot(
    @Param('id') id: string,
    @Param('lotId') lotId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const lot = await this.auctionService.unsoldLot(id, lotId, user.id);
    this.gateway.broadcastLotUnsold(id, lotId);
    return lot;
  }

  @Get(':id/lots/:lotId/bids')
  getBidHistory(
    @Param('id') id: string,
    @Param('lotId') lotId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auctionService.getBidHistory(id, lotId, user.id);
  }
}
