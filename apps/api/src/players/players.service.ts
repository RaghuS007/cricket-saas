import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PlayerRole } from '@prisma/client';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.player.findMany();
  }

  create(data: {
    name: string;
    role: PlayerRole;
    country?: string;
    basePrice: number;
    isOverseas?: boolean;
  }) {
    return this.prisma.player.create({ data });
  }
}
