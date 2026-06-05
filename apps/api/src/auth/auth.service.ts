import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async register(email: string, password: string, displayName?: string) {
    const existing = await this.prisma.userProfile.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.userProfile.create({
      data: { email, passwordHash, displayName: displayName ?? null },
    });

    return { accessToken: this.sign(user.id, user.email), user: { id: user.id, email: user.email } };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.userProfile.findUnique({ where: { email } });
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return { accessToken: this.sign(user.id, user.email), user: { id: user.id, email: user.email } };
  }

  private sign(userId: string, email: string): string {
    return sign(
      { sub: userId, email },
      this.config.getOrThrow<string>('JWT_SECRET'),
      { expiresIn: '7d' },
    );
  }
}
