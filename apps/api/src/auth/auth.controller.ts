import { Controller, Post } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth.types';
import { UserProfileService } from '../user-profile/user-profile.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly userProfileService: UserProfileService) {}

  /**
   * Called by the frontend once after Supabase login to create/sync the
   * UserProfile row in our database from the JWT claims.
   */
  @Post('sync-profile')
  syncProfile(@CurrentUser() user: AuthUser) {
    return this.userProfileService.upsert(user);
  }
}
