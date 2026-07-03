import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { PrismaClient, PlayerRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

let uidCounter = 0;
export function uniqueEmail(prefix = 'e2e'): string {
  uidCounter += 1;
  return `${prefix}-${Date.now()}-${uidCounter}@example.com`;
}

// Mirrors main.ts's bootstrap() — e2e tests build the app directly via
// TestingModule and never go through main.ts, so the global pipe/filter
// setup has to be duplicated here or none of it would actually be exercised.
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

export interface TestUser {
  accessToken: string;
  userId: string;
  email: string;
}

export async function registerUser(
  app: INestApplication<App>,
  overrides: Partial<{ email: string; password: string; displayName: string }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? 'password123';
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, displayName: overrides.displayName })
    .expect(201);
  return { accessToken: res.body.accessToken, userId: res.body.user.id, email };
}

export async function createOrgForUser(
  app: INestApplication<App>,
  user: TestUser,
  name = 'Test League',
): Promise<{ id: string; slug: string }> {
  const slug = `test-league-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const res = await request(app.getHttpServer())
    .post('/organizations')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ name, slug })
    .expect(201);
  return res.body;
}

/** Registers a user and gives them an org in one step — the common case. */
export async function registerUserWithOrg(
  app: INestApplication<App>,
  overrides: Partial<{ email: string; password: string; displayName: string }> = {},
): Promise<TestUser & { orgId: string }> {
  const user = await registerUser(app, overrides);
  const org = await createOrgForUser(app, user);
  return { ...user, orgId: org.id };
}

const FIXTURE_TEAMS = [
  { name: 'QA Fixture Team Alpha', shortName: 'QFA', primaryColor: '#111111' },
  { name: 'QA Fixture Team Beta', shortName: 'QFB', primaryColor: '#222222' },
  { name: 'QA Fixture Team Gamma', shortName: 'QFG', primaryColor: '#333333' },
];

const FIXTURE_PLAYERS: Array<{ name: string; role: PlayerRole; basePrice: number; isOverseas?: boolean }> = [
  { name: 'QA Fixture Player One', role: PlayerRole.BAT, basePrice: 1_000_000 },
  { name: 'QA Fixture Player Two', role: PlayerRole.BOWL, basePrice: 2_000_000, isOverseas: true },
  { name: 'QA Fixture Player Three', role: PlayerRole.ALL_ROUNDER, basePrice: 1_500_000 },
];

/**
 * Global (organizationId: null) teams/players are read-only reference data in
 * this app — there's no API to create teams, so e2e auction flows need a few
 * to already exist. Idempotent: safe to call from every spec file's beforeAll.
 */
export async function ensureGlobalFixtures(): Promise<{
  teamIds: string[];
  playerIds: string[];
}> {
  const prisma = new PrismaClient();
  try {
    const teamIds: string[] = [];
    for (const t of FIXTURE_TEAMS) {
      // Prisma's compound-unique `where` doesn't accept `null` for a nullable
      // key component, so `upsert` can't target { organizationId: null, shortName }
      // directly — fall back to find-or-create instead.
      let team = await prisma.team.findFirst({ where: { organizationId: null, shortName: t.shortName } });
      if (!team) team = await prisma.team.create({ data: t });
      teamIds.push(team.id);
    }

    const playerIds: string[] = [];
    for (const p of FIXTURE_PLAYERS) {
      let player = await prisma.player.findFirst({ where: { name: p.name, organizationId: null } });
      if (!player) {
        player = await prisma.player.create({ data: p });
      }
      playerIds.push(player.id);
    }

    return { teamIds, playerIds };
  } finally {
    await prisma.$disconnect();
  }
}
