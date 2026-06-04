import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto, userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!profile) throw new BadRequestException('User profile not found — call /auth/sync-profile first');
    if (profile.organizationId)
      throw new ConflictException('User already belongs to an organization');

    const existing = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name: dto.name, slug: dto.slug },
      });
      await tx.userProfile.update({
        where: { id: userId },
        data: { organizationId: created.id, role: OrgRole.OWNER },
      });
      return created;
    });

    return org;
  }

  async findMine(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    return profile?.organization ?? null;
  }
}
