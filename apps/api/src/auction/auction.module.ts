import { Module } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { AuctionController } from './auction.controller';
import { AuctionGateway } from './auction.gateway';

@Module({
  providers: [AuctionService, AuctionGateway],
  controllers: [AuctionController],
})
export class AuctionModule {}
