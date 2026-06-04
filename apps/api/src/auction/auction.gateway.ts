import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import type {
  AuctionBidPayload,
  AuctionLotSoldPayload,
  AuctionLotStartedPayload,
  AuctionLotUnsoldPayload,
  AuctionStatusPayload,
} from './auction.types';

interface AuthSocket extends Socket {
  data: {
    user: { id: string; email: string };
  };
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3001', credentials: true },
  namespace: '/auction',
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AuctionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly auctionService: AuctionService) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────

  afterInit(server: Server) {
    // Authenticate every socket connection via Bearer token in handshake.auth
    server.use((socket, next) => {
      const token: string | undefined = (socket.handshake.auth as Record<string, string>)?.token;
      if (!token) return next(new Error('UNAUTHORIZED'));
      try {
        const payload = verify(token, process.env.SUPABASE_JWT_SECRET!) as {
          sub: string;
          email: string;
        };
        (socket as AuthSocket).data.user = { id: payload.sub, email: payload.email };
        next();
      } catch {
        next(new Error('UNAUTHORIZED'));
      }
    });
  }

  handleConnection(client: AuthSocket) {
    console.log(`WS connected: ${client.id} (${client.data.user?.email ?? 'unknown'})`);
  }

  handleDisconnect(client: AuthSocket) {
    console.log(`WS disconnected: ${client.id}`);
  }

  // ── Room management ──────────────────────────────────────────────────────

  @SubscribeMessage('join-auction')
  handleJoin(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { auctionId: string },
  ) {
    client.join(`auction:${payload.auctionId}`);
    return { event: 'joined', data: { auctionId: payload.auctionId } };
  }

  @SubscribeMessage('leave-auction')
  handleLeave(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { auctionId: string },
  ) {
    client.leave(`auction:${payload.auctionId}`);
    return { event: 'left', data: { auctionId: payload.auctionId } };
  }

  // ── Bidding ──────────────────────────────────────────────────────────────

  @SubscribeMessage('place-bid')
  async handlePlaceBid(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() dto: PlaceBidDto,
  ) {
    try {
      const { bid, team } = await this.auctionService.placeBid(
        dto.auctionId,
        dto.lotId,
        dto.auctionTeamId,
        dto.amount,
        client.data.user.id,
      );

      const payload: AuctionBidPayload = {
        auctionId: dto.auctionId,
        lotId: dto.lotId,
        amount: bid.amount.toString(),
        auctionTeamId: dto.auctionTeamId,
        teamName: team.team.name,
        highestBid: bid.amount.toString(),
      };
      this.server.to(`auction:${dto.auctionId}`).emit('auction:bid', payload);
      return { event: 'bid-accepted', data: payload };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bid failed';
      throw new WsException(message);
    }
  }

  // ── Broadcast helpers (called by AuctionController after HTTP mutations) ─

  broadcastStatus(auctionId: string, status: string) {
    const payload: AuctionStatusPayload = { auctionId, status };
    this.server.to(`auction:${auctionId}`).emit('auction:status', payload);
  }

  broadcastLotStarted(
    auctionId: string,
    lot: AuctionLotStartedPayload['lot'],
  ) {
    const payload: AuctionLotStartedPayload = { auctionId, lot };
    this.server.to(`auction:${auctionId}`).emit('auction:lot-started', payload);
  }

  broadcastLotSold(auctionId: string, data: Omit<AuctionLotSoldPayload, 'auctionId'>) {
    const payload: AuctionLotSoldPayload = { auctionId, ...data };
    this.server.to(`auction:${auctionId}`).emit('auction:lot-sold', payload);
  }

  broadcastLotUnsold(auctionId: string, lotId: string) {
    const payload: AuctionLotUnsoldPayload = { auctionId, lotId };
    this.server.to(`auction:${auctionId}`).emit('auction:lot-unsold', payload);
  }
}
