import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  shortName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor must be a hex color like #16a34a' })
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  coOwnerName?: string;
}
