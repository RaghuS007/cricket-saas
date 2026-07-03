import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';
import { PrismaService } from '../prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PLAYER_PHOTO_DIR } from './player-photo.storage';

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
