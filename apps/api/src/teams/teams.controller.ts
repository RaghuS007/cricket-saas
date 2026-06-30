import { Controller, Get } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.teamsService.findAll(user.id);
  }
}
