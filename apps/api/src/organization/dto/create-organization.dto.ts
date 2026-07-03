import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  // URL-safe slug: lowercase letters, digits, hyphens only
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, digits and hyphens' })
  @MinLength(2)
  @MaxLength(60)
  slug!: string;
}
