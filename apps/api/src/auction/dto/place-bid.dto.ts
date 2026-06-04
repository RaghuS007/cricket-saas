import { IsNumber, IsString, Min } from 'class-validator';

export class PlaceBidDto {
  @IsString()
  auctionId!: string;

  @IsString()
  lotId!: string;

  @IsString()
  auctionTeamId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}
