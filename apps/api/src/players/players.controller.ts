import { Body, Controller, Get, Post } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PlayerRole } from '@prisma/client';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  findAll() {
    return this.playersService.findAll();
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      role: PlayerRole;
      country?: string;
      basePrice: number;
      isOverseas?: boolean;
    },
  ) {
    return this.playersService.create(body);
  }
}
