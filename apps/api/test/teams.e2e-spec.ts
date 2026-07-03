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
});
