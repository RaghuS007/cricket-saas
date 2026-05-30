import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.player.findMany();
  }

  create(data: CreatePlayerDto) {
    return this.prisma.player.create({ data });
  }
}
