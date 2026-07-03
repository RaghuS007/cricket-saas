import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MatchFormat } from '@prisma/client';

const MAX_MONEY = 999_999_999_999;

export class UpdateAuctionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(MatchFormat)
  format?: MatchFormat;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  purseSizePerTeam?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxSquadSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  maxOverseasPerSquad?: number;
}
