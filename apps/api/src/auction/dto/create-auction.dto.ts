import { IsEnum, IsInt, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MatchFormat } from '@prisma/client';

// purseSizePerTeam/etc. are stored as Decimal(14,2) — keep well under that ceiling
// so an out-of-range value fails clean validation instead of a raw DB error.
const MAX_MONEY = 999_999_999_999;

export class CreateAuctionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsEnum(MatchFormat)
  format!: MatchFormat;

  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  purseSizePerTeam!: number;

  @IsInt()
  @Min(1)
  @Max(50)
  maxSquadSize!: number;

  @IsInt()
  @Min(0)
  @Max(50)
  maxOverseasPerSquad!: number;
}
