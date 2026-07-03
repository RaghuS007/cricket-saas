import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, ensureGlobalFixtures, registerUserWithOrg } from './helpers';

describe('Teams (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
    await ensureGlobalFixtures();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists global teams', async () => {
    const user = await registerUserWithOrg(app);
    const res = await request(app.getHttpServer())
      .get('/teams')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.some((t: { shortName: string }) => t.shortName === 'QFA')).toBe(true);
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/teams').expect(401);
  });

  describe('logo upload', () => {
    // A minimal valid 1x1 PNG, used as a real file for multipart upload tests.
    const PNG_BUFFER = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );

    async function createTeam(user: { accessToken: string }, shortName: string) {
      const res = await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: `Logo Team ${shortName}`, shortName })
        .expect(201);
      return res.body as { id: string };
    }

    it('uploads a logo for a team the caller owns and returns the new logoUrl', async () => {
      const user = await registerUserWithOrg(app);
      const team = await createTeam(user, `LG${Date.now() % 100000}`);

      const res = await request(app.getHttpServer())
        .post(`/teams/${team.id}/logo`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .attach('logo', PNG_BUFFER, 'logo.png')
        .expect(201);

      expect(res.body.logoUrl).toMatch(/^\/uploads\/team-logos\/.+\.png$/);
    });

    it('rejects an unauthenticated request', async () => {
      const user = await registerUserWithOrg(app);
      const team = await createTeam(user, `LG${(Date.now() + 1) % 100000}`);

      await request(app.getHttpServer())
        .post(`/teams/${team.id}/logo`)
        .attach('logo', PNG_BUFFER, 'logo.png')
        .expect(401);
    });

    it('rejects uploading a logo with no file attached', async () => {
      const user = await registerUserWithOrg(app);
      const team = await createTeam(user, `LG${(Date.now() + 2) % 100000}`);

      await request(app.getHttpServer())
        .post(`/teams/${team.id}/logo`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(400);
    });

    it('rejects a non-image file type', async () => {
      const user = await registerUserWithOrg(app);
      const team = await createTeam(user, `LG${(Date.now() + 3) % 100000}`);

      await request(app.getHttpServer())
        .post(`/teams/${team.id}/logo`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .attach('logo', Buffer.from('not an image'), 'evil.txt')
        .expect(400);
    });

    it("rejects uploading a logo for another organization's team (IDOR)", async () => {
      const owner = await registerUserWithOrg(app);
      const attacker = await registerUserWithOrg(app);
      const team = await createTeam(owner, `LG${(Date.now() + 4) % 100000}`);

      await request(app.getHttpServer())
        .post(`/teams/${team.id}/logo`)
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .attach('logo', PNG_BUFFER, 'logo.png')
        .expect(404);
    });

    it('rejects uploading a logo for a global (organizationId: null) seed team', async () => {
      const user = await registerUserWithOrg(app);
      const fixtures = await ensureGlobalFixtures();

      await request(app.getHttpServer())
        .post(`/teams/${fixtures.teamIds[0]}/logo`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .attach('logo', PNG_BUFFER, 'logo.png')
        .expect(404);
    });
  });

  describe('DELETE /teams/:id', () => {
    async function createTeam(user: { accessToken: string }, shortName: string) {
      const res = await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: `Delete Team ${shortName}`, shortName })
        .expect(201);
      return res.body as { id: string };
    }

    it('deletes a team that belongs to the caller organization and is unused', async () => {
      const user = await registerUserWithOrg(app);
      const team = await createTeam(user, `DL${Date.now() % 100000}`);

      await request(app.getHttpServer())
        .delete(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      const list = await request(app.getHttpServer())
        .get('/teams')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(list.body.find((t: { id: string }) => t.id === team.id)).toBeUndefined();
    });

    it('rejects an unauthenticated request', async () => {
      const user = await registerUserWithOrg(app);
      const team = await createTeam(user, `DL${(Date.now() + 1) % 100000}`);

      await request(app.getHttpServer()).delete(`/teams/${team.id}`).expect(401);
    });

    it('rejects deleting a global (organizationId: null) seed team', async () => {
      const user = await registerUserWithOrg(app);
      const fixtures = await ensureGlobalFixtures();

      await request(app.getHttpServer())
        .delete(`/teams/${fixtures.teamIds[0]}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);
    });

    it("rejects deleting another organization's team (IDOR)", async () => {
      const owner = await registerUserWithOrg(app);
      const attacker = await registerUserWithOrg(app);
      const team = await createTeam(owner, `DL${(Date.now() + 2) % 100000}`);

      await request(app.getHttpServer())
        .delete(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .expect(404);
    });

    it('rejects deleting a team that is still added to an auction', async () => {
      const user = await registerUserWithOrg(app);
      const team = await createTeam(user, `DL${(Date.now() + 3) % 100000}`);

      const auctionRes = await request(app.getHttpServer())
        .post('/auctions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Delete-guard Auction', format: 'T20', purseSizePerTeam: 1_000_000, maxSquadSize: 15, maxOverseasPerSquad: 4 })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/auctions/${auctionRes.body.id}/teams`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ teamId: team.id })
        .expect(201);

      const res = await request(app.getHttpServer())
        .delete(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(409);
      expect(res.body.message).toMatch(/used in 1 auction/);
    });
  });
});
