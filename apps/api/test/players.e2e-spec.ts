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
});
