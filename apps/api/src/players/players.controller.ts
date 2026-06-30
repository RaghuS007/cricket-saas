import { Body, Controller, Get, Post } from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.playersService.findAll(user.id);
  }

  @Post()
  create(@Body() body: CreatePlayerDto) {
    return this.playersService.create(body);
  }
}
