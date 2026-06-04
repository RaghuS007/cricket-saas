import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class UserProfileService {
  constructor(private prisma: PrismaService) {}

  /** Create or update the UserProfile row from Supabase JWT claims. */
  upsert(user: AuthUser) {
    return this.prisma.userProfile.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email },
      update: { email: user.email },
    });
  }

  findOne(id: string) {
    return this.prisma.userProfile.findUnique({ where: { id } });
  }
}
