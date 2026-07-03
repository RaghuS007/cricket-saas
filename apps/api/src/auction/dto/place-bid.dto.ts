import { IsNumber, IsPositive, IsString, Max } from 'class-validator';

export class PlaceBidDto {
  @IsString()
  auctionId!: string;

  @IsString()
  lotId!: string;

  @IsString()
  auctionTeamId!: string;

  @IsNumber()
  @IsPositive()
  @Max(999_999_999_999)
  amount!: number;
}
