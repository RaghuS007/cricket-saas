import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, ensureGlobalFixtures, registerUser, registerUserWithOrg } from './helpers';

describe('Players (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
    await ensureGlobalFixtures();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /players', () => {
    it('lists global players for an org with no custom players', async () => {
      const user = await registerUserWithOrg(app);
      const res = await request(app.getHttpServer())
        .get('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((p: { organizationId: string | null }) => p.organizationId === null)).toBe(true);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/players').expect(401);
    });
  });

  describe('POST /players', () => {
    it('creates a player scoped to the caller organization', async () => {
      const user = await registerUserWithOrg(app);
      const res = await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Custom Player', role: 'BAT', basePrice: 500000 })
        .expect(201);
      expect(res.body.organizationId).toBe(user.orgId);

      // ...and is visible only to that org, not globally or to other orgs.
      const otherOrg = await registerUserWithOrg(app);
      const otherList = await request(app.getHttpServer())
        .get('/players')
        .set('Authorization', `Bearer ${otherOrg.accessToken}`)
        .expect(200);
      expect(otherList.body.find((p: { id: string }) => p.id === res.body.id)).toBeUndefined();

      const ownList = await request(app.getHttpServer())
        .get('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(ownList.body.find((p: { id: string }) => p.id === res.body.id)).toBeTruthy();
    });

    it('ignores/rejects a client-supplied organizationId (IDOR regression test)', async () => {
      const user = await registerUserWithOrg(app);
      // organizationId isn't a field on the DTO anymore — sending it must be rejected outright.
      const res = await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Spoofed', role: 'BAT', basePrice: 100, organizationId: null })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toMatch(/organizationId/);
    });

    it('rejects creation from a user with no organization', async () => {
      const { accessToken } = await registerUser(app);
      await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Orphan Player', role: 'BAT', basePrice: 100 })
        .expect(403);
    });

    it('rejects an invalid role enum', async () => {
      const user = await registerUserWithOrg(app);
      await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'X', role: 'GOALKEEPER', basePrice: 100 })
        .expect(400);
    });

    it('rejects a negative base price', async () => {
      const user = await registerUserWithOrg(app);
      await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'X', role: 'BAT', basePrice: -100 })
        .expect(400);
    });

    it('rejects an absurdly large base price beyond DB precision', async () => {
      const user = await registerUserWithOrg(app);
      await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'X', role: 'BAT', basePrice: 1e18 })
        .expect(400);
    });

    it('accepts unicode/emoji names and a long-but-valid name', async () => {
      const user = await registerUserWithOrg(app);
      const res = await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'M.S. Dhoni 🏏 धोनी', role: 'WICKET_KEEPER', basePrice: 100 })
        .expect(201);
      expect(res.body.name).toBe('M.S. Dhoni 🏏 धोनी');
    });

    it('rejects a name over 100 chars', async () => {
      const user = await registerUserWithOrg(app);
      await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'x'.repeat(101), role: 'BAT', basePrice: 100 })
        .expect(400);
    });

    it('rejects a non-URL avatarUrl', async () => {
      const user = await registerUserWithOrg(app);
      await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'X', role: 'BAT', basePrice: 100, avatarUrl: 'javascript:alert(1)' })
        .expect(400);
    });
  });

  describe('photo upload', () => {
    // A minimal valid 1x1 PNG, used as a real file for multipart upload tests.
    const PNG_BUFFER = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );

    async function createPlayer(user: { accessToken: string }, name: string) {
      const res = await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name, role: 'BAT', basePrice: 100 })
        .expect(201);
      return res.body as { id: string };
    }

    it('uploads a photo for a player the caller owns and returns the new photoUrl', async () => {
      const user = await registerUserWithOrg(app);
      const player = await createPlayer(user, `Photo Player ${Date.now()}`);

      const res = await request(app.getHttpServer())
        .post(`/players/${player.id}/photo`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .attach('photo', PNG_BUFFER, 'photo.png')
        .expect(201);

      expect(res.body.photoUrl).toMatch(/^\/uploads\/player-photos\/.+\.png$/);
    });

    it('rejects an unauthenticated request', async () => {
      const user = await registerUserWithOrg(app);
      const player = await createPlayer(user, `Photo Player ${Date.now() + 1}`);

      await request(app.getHttpServer())
        .post(`/players/${player.id}/photo`)
        .attach('photo', PNG_BUFFER, 'photo.png')
        .expect(401);
    });

    it('rejects uploading a photo with no file attached', async () => {
      const user = await registerUserWithOrg(app);
      const player = await createPlayer(user, `Photo Player ${Date.now() + 2}`);

      await request(app.getHttpServer())
        .post(`/players/${player.id}/photo`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(400);
    });

    it('rejects a non-image file type', async () => {
      const user = await registerUserWithOrg(app);
      const player = await createPlayer(user, `Photo Player ${Date.now() + 3}`);

      await request(app.getHttpServer())
        .post(`/players/${player.id}/photo`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .attach('photo', Buffer.from('not an image'), 'evil.txt')
        .expect(400);
    });

    it("rejects uploading a photo for another organization's player (IDOR)", async () => {
      const owner = await registerUserWithOrg(app);
      const attacker = await registerUserWithOrg(app);
      const player = await createPlayer(owner, `Photo Player ${Date.now() + 4}`);

      await request(app.getHttpServer())
        .post(`/players/${player.id}/photo`)
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .attach('photo', PNG_BUFFER, 'photo.png')
        .expect(404);
    });

    it('rejects uploading a photo for a global (organizationId: null) reference player', async () => {
      const user = await registerUserWithOrg(app);
      const fixtures = await ensureGlobalFixtures();

      await request(app.getHttpServer())
        .post(`/players/${fixtures.playerIds[0]}/photo`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .attach('photo', PNG_BUFFER, 'photo.png')
        .expect(404);
    });
  });

  describe('DELETE /players/:id', () => {
    async function createPlayer(user: { accessToken: string }, name: string) {
      const res = await request(app.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name, role: 'BAT', basePrice: 100 })
        .expect(201);
      return res.body as { id: string };
    }

    it('deletes a player that belongs to the caller organization and is unused', async () => {
      const user = await registerUserWithOrg(app);
      const player = await createPlayer(user, `Delete Player ${Date.now()}`);

      await request(app.getHttpServer())
        .delete(`/players/${player.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      const list = await request(app.getHttpServer())
        .get('/players')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(list.body.find((p: { id: string }) => p.id === player.id)).toBeUndefined();
    });

    it('rejects an unauthenticated request', async () => {
      const user = await registerUserWithOrg(app);
      const player = await createPlayer(user, `Delete Player ${Date.now() + 1}`);

      await request(app.getHttpServer()).delete(`/players/${player.id}`).expect(401);
    });

    it('rejects deleting a global (organizationId: null) reference player', async () => {
      const user = await registerUserWithOrg(app);
      const fixtures = await ensureGlobalFixtures();

      await request(app.getHttpServer())
        .delete(`/players/${fixtures.playerIds[0]}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);
    });

    it("rejects deleting another organization's player (IDOR)", async () => {
      const owner = await registerUserWithOrg(app);
      const attacker = await registerUserWithOrg(app);
      const player = await createPlayer(owner, `Delete Player ${Date.now() + 2}`);

      await request(app.getHttpServer())
        .delete(`/players/${player.id}`)
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .expect(404);
    });

    it('rejects deleting a player that still appears in an auction lot', async () => {
      const user = await registerUserWithOrg(app);
      const player = await createPlayer(user, `Delete Player ${Date.now() + 3}`);

      const auctionRes = await request(app.getHttpServer())
        .post('/auctions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Delete-guard Auction', format: 'T20', purseSizePerTeam: 1_000_000, maxSquadSize: 15, maxOverseasPerSquad: 4 })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/auctions/${auctionRes.body.id}/lots`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ playerIds: [player.id] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .delete(`/players/${player.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(409);
      expect(res.body.message).toMatch(/1 auction lot/);
    });
  });
});
