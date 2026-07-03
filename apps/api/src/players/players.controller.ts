import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
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
  create(@Body() body: CreatePlayerDto, @CurrentUser() user: AuthUser) {
    return this.playersService.create(body, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePlayerDto, @CurrentUser() user: AuthUser) {
    return this.playersService.update(id, body, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.playersService.remove(id, user.id);
  }
}
