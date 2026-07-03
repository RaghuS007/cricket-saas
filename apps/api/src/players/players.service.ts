import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlayerRole, type Player } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';
import { PrismaService } from '../prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PLAYER_PHOTO_DIR } from './player-photo.storage';

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

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}

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

  async importCsv(file: Express.Multer.File, userId: string) {
    if (file.size > MAX_CSV_BYTES) throw new BadRequestException('CSV must be 1MB or smaller');
    const orgId = await this.getOrgId(userId);
    const rows = parseCsv(file.buffer);
    if (rows.length === 0) throw new BadRequestException('CSV has no rows');

    const imported: Player[] = [];
    for (const [index, row] of rows.entries()) {
      const name = row.name;
      const role = row.role as PlayerRole;
      const basePrice = Number(row.baseprice || row.base_price);
      if (!name || !role || Number.isNaN(basePrice)) {
        throw new BadRequestException(`Row ${index + 2}: name, role, and basePrice are required`);
      }
      if (!Object.values(PlayerRole).includes(role)) {
        throw new BadRequestException(`Row ${index + 2}: role must be BAT, BOWL, ALL_ROUNDER, or WICKET_KEEPER`);
      }

      imported.push(
        await this.prisma.player.create({
          data: {
            name,
            role,
            country: row.country || undefined,
            basePrice: new Decimal(basePrice),
            isOverseas: parseBoolean(row.isoverseas || row.is_overseas) ?? false,
            avatarUrl: row.avatarurl || row.avatar_url || undefined,
            photoUrl: row.photourl || row.photo_url || undefined,
            organizationId: orgId,
          },
        }),
      );
    }

    return { imported: imported.length, items: imported };
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

  async updatePhoto(id: string, photoUrl: string, userId: string) {
    const orgId = await this.getOrgId(userId);
    const player = await this.prisma.player.findFirst({ where: { id, organizationId: orgId } });
    if (!player) throw new NotFoundException(`Player ${id} not found`);

    if (player.photoUrl) {
      // Best-effort cleanup of the previous file; a missing file is not an error.
      await unlink(join(PLAYER_PHOTO_DIR, basename(player.photoUrl))).catch(() => undefined);
    }

    return this.prisma.player.update({ where: { id }, data: { photoUrl } });
  }

  async remove(id: string, userId: string) {
    const orgId = await this.getOrgId(userId);

    // Count-then-delete inside one transaction so a player can't be added to
    // a lot between the usage check and the delete (TOCTOU). The AuctionLot
    // FK is onDelete: Restrict anyway, but that only protects the DB row —
    // without the pre-check the caller would see an opaque 500 instead of a
    // clear "still in use" message.
    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findFirst({ where: { id, organizationId: orgId } });
      if (!player) throw new NotFoundException(`Player ${id} not found`);

      const usageCount = await tx.auctionLot.count({ where: { playerId: id } });
      if (usageCount > 0) {
        throw new ConflictException(
          `Cannot delete player "${player.name}" — they appear in ${usageCount} auction lot${usageCount === 1 ? '' : 's'}. Remove them from those auctions first.`,
        );
      }

      return tx.player.delete({ where: { id } });
    });
  }
}
