import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  private async getOrgId(userId: string): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!profile?.organizationId)
      throw new ForbiddenException('User is not assigned to an organization');
    return profile.organizationId;
  }

  async findAll(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    return this.prisma.player.findMany({
      where: {
        OR: [
          { organizationId: null },
          ...(profile?.organizationId ? [{ organizationId: profile.organizationId }] : []),
        ],
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: CreatePlayerDto, userId: string) {
    const orgId = await this.getOrgId(userId);
    return this.prisma.player.create({ data: { ...data, organizationId: orgId } });
  }

  async update(id: string, data: UpdatePlayerDto, userId: string) {
    const orgId = await this.getOrgId(userId);
    // Only ever match a player that belongs to the caller's own org — this
    // also blocks edits to global (organizationId: null) reference data and
    // to other orgs' custom players, without leaking which case applies.
    const player = await this.prisma.player.findFirst({ where: { id, organizationId: orgId } });
    if (!player) throw new NotFoundException(`Player ${id} not found`);

    return this.prisma.player.update({ where: { id }, data });
  }
}
