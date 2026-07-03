import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
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

    return this.prisma.team.findMany({
      where: {
        OR: [
          { organizationId: null },
          ...(profile?.organizationId ? [{ organizationId: profile.organizationId }] : []),
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: CreateTeamDto, userId: string) {
    const orgId = await this.getOrgId(userId);
    return this.prisma.team.create({ data: { ...data, organizationId: orgId } });
  }

  async update(id: string, data: UpdateTeamDto, userId: string) {
    const orgId = await this.getOrgId(userId);
    // Only ever match a team that belongs to the caller's own org — blocks
    // edits to global (organizationId: null) reference data and to other
    // orgs' custom teams, without leaking which case applies.
    const team = await this.prisma.team.findFirst({ where: { id, organizationId: orgId } });
    if (!team) throw new NotFoundException(`Team ${id} not found`);

    return this.prisma.team.update({ where: { id }, data });
  }
}
