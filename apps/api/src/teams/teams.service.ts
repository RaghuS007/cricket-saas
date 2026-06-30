import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

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
}
