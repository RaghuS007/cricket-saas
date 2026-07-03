import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.teamsService.findAll(user.id);
  }

  @Post()
  create(@Body() body: CreateTeamDto, @CurrentUser() user: AuthUser) {
    return this.teamsService.create(body, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateTeamDto, @CurrentUser() user: AuthUser) {
    return this.teamsService.update(id, body, user.id);
  }
}
