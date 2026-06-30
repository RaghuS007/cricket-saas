import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PlayerRole } from '@prisma/client';

export class CreatePlayerDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(PlayerRole)
  role!: PlayerRole;

  @IsOptional()
  @IsString()
  country?: string;

  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsBoolean()
  isOverseas?: boolean;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;
}
