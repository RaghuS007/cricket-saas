import { IsString, Matches, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // URL-safe slug: lowercase letters, digits, hyphens only
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, digits and hyphens' })
  @MinLength(2)
  slug!: string;
}
