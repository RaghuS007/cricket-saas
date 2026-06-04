import { IsNumber, IsString, Min } from 'class-validator';

export class SellLotDto {
  @IsString()
  auctionTeamId!: string;

  @IsNumber()
  @Min(0)
  soldPrice!: number;
}
