import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Team } from '@prisma/client';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';
import { PrismaService } from '../prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TEAM_LOGO_DIR } from './team-logo.storage';

const MAX_CSV_BYTES = 1024 * 1024;

function parseCsv(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  rows.push(row);

  const [headers, ...data] = rows;
  const normalized = headers.map((h) => h.trim().toLowerCase());
  return data
    .filter((r) => r.some(Boolean))
    .map((r) => Object.fromEntries(normalized.map((h, i) => [h, r[i]?.trim() ?? ''])));
}

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

  async importCsv(file: Express.Multer.File, userId: string) {
    if (file.size > MAX_CSV_BYTES) throw new BadRequestException('CSV must be 1MB or smaller');
    const orgId = await this.getOrgId(userId);
    const rows = parseCsv(file.buffer);
    if (rows.length === 0) throw new BadRequestException('CSV has no rows');

    const imported: Team[] = [];
    for (const [index, row] of rows.entries()) {
      const name = row.name;
      const shortName = row.shortname || row.short_name;
      if (!name || !shortName) throw new BadRequestException(`Row ${index + 2}: name and shortName are required`);
      const primaryColor = row.primarycolor || row.primary_color || undefined;
      if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
        throw new BadRequestException(`Row ${index + 2}: primaryColor must be a hex color like #16a34a`);
      }

      imported.push(
        await this.prisma.team.upsert({
          where: { organizationId_shortName: { organizationId: orgId, shortName: shortName.toUpperCase() } },
          create: {
            name,
            shortName: shortName.toUpperCase(),
            primaryColor,
            logoUrl: row.logourl || row.logo_url || undefined,
            ownerName: row.ownername || row.owner_name || undefined,
            coOwnerName: row.coownername || row.co_owner_name || undefined,
            organizationId: orgId,
          },
          update: {
            name,
            primaryColor,
            logoUrl: row.logourl || row.logo_url || undefined,
            ownerName: row.ownername || row.owner_name || undefined,
            coOwnerName: row.coownername || row.co_owner_name || undefined,
          },
        }),
      );
    }

    return { imported: imported.length, items: imported };
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

  async updateLogo(id: string, logoUrl: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const team = await this.prisma.team.findFirst({ where: { id, organizationId: orgId } });
    if (!team) throw new NotFoundException(`Team ${id} not found`);

    if (team.logoUrl) {
      // Best-effort cleanup of the previous file; a missing file is not an error.
      await unlink(join(TEAM_LOGO_DIR, basename(team.logoUrl))).catch(() => undefined);
    }

    return this.prisma.team.update({ where: { id }, data: { logoUrl } });
  }

  async remove(id: string, userId: string) {
    const orgId = await this.getOrgId(userId);

    // Count-then-delete inside one transaction so a team can't be added to an
    // auction between the usage check and the delete (TOCTOU). The AuctionTeam
    // FK is onDelete: Restrict anyway, but that only protects the DB row —
    // without the pre-check the caller would see an opaque 500 instead of a
    // clear "still in use" message.
    const team = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({ where: { id, organizationId: orgId } });
      if (!team) throw new NotFoundException(`Team ${id} not found`);

      const usageCount = await tx.auctionTeam.count({ where: { teamId: id } });
      if (usageCount > 0) {
        throw new ConflictException(
          `Cannot delete team "${team.name}" — it is used in ${usageCount} auction${usageCount === 1 ? '' : 's'}. Remove it from those auctions first.`,
        );
      }

      return tx.team.delete({ where: { id } });
    });

    if (team.logoUrl) {
      await unlink(join(TEAM_LOGO_DIR, basename(team.logoUrl))).catch(() => undefined);
    }

    return team;
  }
}
