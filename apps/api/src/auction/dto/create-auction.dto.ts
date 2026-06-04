import { IsEnum, IsInt, IsNumber, IsString, Min, MinLength } from 'class-validator';
import { MatchFormat } from '@prisma/client';

export class CreateAuctionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(MatchFormat)
  format!: MatchFormat;

  @IsNumber()
  @Min(0)
  purseSizePerTeam!: number;

  @IsInt()
  @Min(1)
  maxSquadSize!: number;

  @IsInt()
  @Min(0)
  maxOverseasPerSquad!: number;
}
