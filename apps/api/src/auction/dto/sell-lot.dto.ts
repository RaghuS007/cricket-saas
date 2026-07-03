import { IsString } from 'class-validator';

export class SellLotDto {
  @IsString()
  auctionTeamId!: string;
}
