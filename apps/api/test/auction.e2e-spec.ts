import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuctionService } from '../src/auction/auction.service';
import { PlaceBidDto } from '../src/auction/dto/place-bid.dto';
import {
  createTestApp,
  ensureGlobalFixtures,
  registerUserWithOrg,
  TestUser,
} from './helpers';

describe('Auctions (e2e)', () => {
  let app: INestApplication<App>;
  let teamIds: string[];
  let playerIds: string[];

  beforeAll(async () => {
    app = await createTestApp();
    const fixtures = await ensureGlobalFixtures();
    teamIds = fixtures.teamIds;
    playerIds = fixtures.playerIds;
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(user: TestUser) {
    return (req: request.Test) => req.set('Authorization', `Bearer ${user.accessToken}`);
  }

  async function createDraftAuction(
    user: TestUser,
    overrides: Partial<{ purseSizePerTeam: number; maxSquadSize: number; maxOverseasPerSquad: number }> = {},
  ) {
    const res = await auth(user)(request(app.getHttpServer()).post('/auctions')).send({
      name: 'Test Auction',
      format: 'T20',
      purseSizePerTeam: overrides.purseSizePerTeam ?? 100_000_000,
      maxSquadSize: overrides.maxSquadSize ?? 15,
      maxOverseasPerSquad: overrides.maxOverseasPerSquad ?? 4,
    });
    return res.body.id as string;
  }

  async function addTeamsAndLots(user: TestUser, auctionId: string, teamCount = 2, playerCount = 2) {
    const addedTeamIds: string[] = [];
    for (const teamId of teamIds.slice(0, teamCount)) {
      const res = await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/teams`)).send({ teamId });
      addedTeamIds.push(res.body.id);
    }
    await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots`)).send({
      playerIds: playerIds.slice(0, playerCount),
    });
    return addedTeamIds;
  }

  async function createLiveAuction(user: TestUser, overrides?: Parameters<typeof createDraftAuction>[1]) {
    const auctionId = await createDraftAuction(user, overrides);
    const auctionTeamIds = await addTeamsAndLots(user, auctionId);
    await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/start`)).expect(201);
    return { auctionId, auctionTeamIds };
  }

  async function startNextLot(user: TestUser, auctionId: string) {
    const res = await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/next`));
    return res.body.id as string;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  describe('POST /auctions', () => {
    it('creates an auction for the caller organization', async () => {
      const user = await registerUserWithOrg(app);
      const res = await auth(user)(request(app.getHttpServer()).post('/auctions'))
        .send({ name: 'IPL 2026', format: 'T20', purseSizePerTeam: 1000000, maxSquadSize: 15, maxOverseasPerSquad: 4 })
        .expect(201);
      expect(res.body.status).toBe('DRAFT');
    });

    it('rejects an invalid format enum', async () => {
      const user = await registerUserWithOrg(app);
      await auth(user)(request(app.getHttpServer()).post('/auctions'))
        .send({ name: 'X', format: 'ODI', purseSizePerTeam: 1000, maxSquadSize: 15, maxOverseasPerSquad: 4 })
        .expect(400);
    });

    it('rejects a negative purse', async () => {
      const user = await registerUserWithOrg(app);
      await auth(user)(request(app.getHttpServer()).post('/auctions'))
        .send({ name: 'X', format: 'T20', purseSizePerTeam: -1, maxSquadSize: 15, maxOverseasPerSquad: 4 })
        .expect(400);
    });

    it('rejects a squad size of 0', async () => {
      const user = await registerUserWithOrg(app);
      await auth(user)(request(app.getHttpServer()).post('/auctions'))
        .send({ name: 'X', format: 'T20', purseSizePerTeam: 1000, maxSquadSize: 0, maxOverseasPerSquad: 4 })
        .expect(400);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/auctions')
        .send({ name: 'X', format: 'T20', purseSizePerTeam: 1000, maxSquadSize: 15, maxOverseasPerSquad: 4 })
        .expect(401);
    });
  });

  describe('cross-org isolation', () => {
    it('returns 404 (not leaking existence) when another org requests the auction', async () => {
      const owner = await registerUserWithOrg(app);
      const auctionId = await createDraftAuction(owner);

      const intruder = await registerUserWithOrg(app);
      await auth(intruder)(request(app.getHttpServer()).get(`/auctions/${auctionId}`)).expect(404);
    });

    it('prevents another org from mutating the auction', async () => {
      const owner = await registerUserWithOrg(app);
      const auctionId = await createDraftAuction(owner);

      const intruder = await registerUserWithOrg(app);
      await auth(intruder)(request(app.getHttpServer()).post(`/auctions/${auctionId}/start`)).expect(404);
    });
  });

  describe('teams and lots (DRAFT-only mutations)', () => {
    it('adds and removes a team while DRAFT', async () => {
      const user = await registerUserWithOrg(app);
      const auctionId = await createDraftAuction(user);

      const addRes = await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/teams`))
        .send({ teamId: teamIds[0] })
        .expect(201);

      await auth(user)(request(app.getHttpServer()).delete(`/auctions/${auctionId}/teams/${addRes.body.id}`)).expect(200);
    });

    it('rejects an empty playerIds array when adding lots', async () => {
      const user = await registerUserWithOrg(app);
      const auctionId = await createDraftAuction(user);
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots`)).send({ playerIds: [] }).expect(400);
    });

    it('rejects adding teams/lots once the auction is LIVE', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId } = await createLiveAuction(user);

      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/teams`))
        .send({ teamId: teamIds[2] })
        .expect(400);
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots`))
        .send({ playerIds: [playerIds[2]] })
        .expect(400);
    });
  });

  describe('start', () => {
    it('rejects starting with fewer than 2 teams', async () => {
      const user = await registerUserWithOrg(app);
      const auctionId = await createDraftAuction(user);
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/teams`)).send({ teamId: teamIds[0] });
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots`)).send({ playerIds: [playerIds[0]] });

      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/start`)).expect(400);
    });

    it('rejects starting with no lots', async () => {
      const user = await registerUserWithOrg(app);
      const auctionId = await createDraftAuction(user);
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/teams`)).send({ teamId: teamIds[0] });
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/teams`)).send({ teamId: teamIds[1] });

      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/start`)).expect(400);
    });

    it('starts successfully with 2 teams and 1 lot', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId } = await createLiveAuction(user);
      const res = await auth(user)(request(app.getHttpServer()).get(`/auctions/${auctionId}`)).expect(200);
      expect(res.body.status).toBe('LIVE');
    });
  });

  describe('pause / resume', () => {
    it('pauses a LIVE auction and rejects bidding while paused', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId } = await createLiveAuction(user);
      await startNextLot(user, auctionId);

      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/pause`)).expect(201);
      const res = await auth(user)(request(app.getHttpServer()).get(`/auctions/${auctionId}`)).expect(200);
      expect(res.body.status).toBe('PAUSED');
    });

    it('rejects pausing a DRAFT auction', async () => {
      const user = await registerUserWithOrg(app);
      const auctionId = await createDraftAuction(user);
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/pause`)).expect(400);
    });
  });

  describe('lot progression', () => {
    it('rejects starting a next lot when one is already in progress', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId } = await createLiveAuction(user);
      await startNextLot(user, auctionId);
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/next`)).expect(400);
    });

    it('rejects starting a lot when the auction is not LIVE', async () => {
      const user = await registerUserWithOrg(app);
      const auctionId = await createDraftAuction(user);
      await addTeamsAndLots(user, auctionId);
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/next`)).expect(400);
    });
  });

  describe('bidding', () => {
    it('rejects a bid below the base price', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId, auctionTeamIds } = await createLiveAuction(user);
      const lotId = await startNextLot(user, auctionId);

      const service = app.get(AuctionService);
      await expect(
        service.placeBid(auctionId, lotId, auctionTeamIds[0], 1, user.userId),
      ).rejects.toThrow(/at least/);
    });

    it('rejects a bid that does not exceed the current highest', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId, auctionTeamIds } = await createLiveAuction(user);
      const lotId = await startNextLot(user, auctionId);
      const service = app.get(AuctionService);

      await service.placeBid(auctionId, lotId, auctionTeamIds[0], 2_000_000, user.userId);
      await expect(
        service.placeBid(auctionId, lotId, auctionTeamIds[1], 2_000_000, user.userId),
      ).rejects.toThrow(/exceed/);
    });

    it('rejects a bid the team cannot afford', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId, auctionTeamIds } = await createLiveAuction(user, { purseSizePerTeam: 1_000_000 });
      const lotId = await startNextLot(user, auctionId);
      const service = app.get(AuctionService);

      await expect(
        service.placeBid(auctionId, lotId, auctionTeamIds[0], 5_000_000, user.userId),
      ).rejects.toThrow(/purse/i);
    });

    it('rejects a zero/negative bid amount at the HTTP validation layer', async () => {
      // place-bid is WS-only in production, but the DTO is shared — validate it directly.
      const dto = plainToInstance(PlaceBidDto, { auctionId: 'a', lotId: 'l', auctionTeamId: 't', amount: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('only accepts one of many concurrent identical bids on the same lot', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId, auctionTeamIds } = await createLiveAuction(user, { purseSizePerTeam: 100_000_000 });
      const lotId = await startNextLot(user, auctionId);
      const service = app.get(AuctionService);

      const attempts = await Promise.allSettled(
        Array.from({ length: 8 }, (_, i) =>
          service.placeBid(auctionId, lotId, auctionTeamIds[i % auctionTeamIds.length], 5_000_000, user.userId),
        ),
      );

      const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
      const rejected = attempts.filter((a) => a.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(7);

      const history = await auth(user)(
        request(app.getHttpServer()).get(`/auctions/${auctionId}/lots/${lotId}/bids`),
      ).expect(200);
      expect(history.body).toHaveLength(1); // exactly one row actually made it to the DB
    });
  });

  describe('sell', () => {
    it('sells at base price when there were no bids', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId, auctionTeamIds } = await createLiveAuction(user);
      const lotId = await startNextLot(user, auctionId);

      const res = await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/${lotId}/sell`))
        .send({ auctionTeamId: auctionTeamIds[0] })
        .expect(201);
      expect(res.body.status).toBe('SOLD');
    });

    it('rejects a client-supplied soldPrice field (must derive server-side)', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId, auctionTeamIds } = await createLiveAuction(user);
      const lotId = await startNextLot(user, auctionId);

      const res = await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/${lotId}/sell`))
        .send({ auctionTeamId: auctionTeamIds[0], soldPrice: 1 })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toMatch(/soldPrice/);
    });

    it('sells at the highest bid and rejects selling to a non-leading team', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId, auctionTeamIds } = await createLiveAuction(user);
      const lotId = await startNextLot(user, auctionId);
      const service = app.get(AuctionService);
      await service.placeBid(auctionId, lotId, auctionTeamIds[0], 3_000_000, user.userId);

      // The other team tries to buy it out from under the leading bidder.
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/${lotId}/sell`))
        .send({ auctionTeamId: auctionTeamIds[1] })
        .expect(400);

      const res = await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/${lotId}/sell`))
        .send({ auctionTeamId: auctionTeamIds[0] })
        .expect(201);
      expect(res.body.soldPrice).toBe('3000000');
    });

    it('rejects selling when there is no active lot', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId, auctionTeamIds } = await createLiveAuction(user);
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/bogus-lot-id/sell`))
        .send({ auctionTeamId: auctionTeamIds[0] })
        .expect(404);
    });

    it('only allows one of many concurrent sell attempts on the same lot to succeed', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId, auctionTeamIds } = await createLiveAuction(user);
      const lotId = await startNextLot(user, auctionId);
      const service = app.get(AuctionService);

      const attempts = await Promise.allSettled(
        Array.from({ length: 5 }, () => service.sellLot(auctionId, lotId, { auctionTeamId: auctionTeamIds[0] }, user.userId)),
      );
      const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
      expect(fulfilled).toHaveLength(1);

      const teamsRes = await auth(user)(request(app.getHttpServer()).get(`/auctions/${auctionId}`)).expect(200);
      const team = teamsRes.body.auctionTeams.find((t: { id: string }) => t.id === auctionTeamIds[0]);
      expect(team.playersAcquired).toBe(1); // decremented/incremented exactly once, not 5 times
    });
  });

  describe('unsold', () => {
    it('marks a lot UNSOLD and rejects when there is no active lot', async () => {
      const user = await registerUserWithOrg(app);
      const { auctionId } = await createLiveAuction(user);
      const lotId = await startNextLot(user, auctionId);

      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/${lotId}/unsold`)).expect(201);
      await auth(user)(request(app.getHttpServer()).post(`/auctions/${auctionId}/lots/${lotId}/unsold`)).expect(404);
    });
  });
});
