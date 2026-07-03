import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, registerUser } from './helpers';

describe('Organizations (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /organizations/me', () => {
    it('returns an empty body for a user with no organization', async () => {
      const user = await registerUser(app);
      const res = await request(app.getHttpServer())
        .get('/organizations/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      // Nest sends an empty body (not a JSON "null") when a handler returns null.
      expect(res.text).toBe('');
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/organizations/me').expect(401);
    });
  });

  describe('POST /organizations', () => {
    it('creates an org and makes the caller its owner', async () => {
      const user = await registerUser(app);
      const slug = `league-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'My League', slug })
        .expect(201);
      expect(res.body.slug).toBe(slug);

      const mine = await request(app.getHttpServer())
        .get('/organizations/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(mine.body.id).toBe(res.body.id);
    });

    it('rejects a user creating a second organization', async () => {
      const user = await registerUser(app);
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'League One', slug: `one-${Date.now()}` })
        .expect(201);

      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'League Two', slug: `two-${Date.now()}` })
        .expect(409);
    });

    it('rejects a duplicate slug across different users', async () => {
      const slug = `shared-slug-${Date.now()}`;
      const userA = await registerUser(app);
      const userB = await registerUser(app);

      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ name: 'League A', slug })
        .expect(201);

      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ name: 'League B', slug })
        .expect(409);
    });

    it('rejects an invalid slug (uppercase/symbols)', async () => {
      const user = await registerUser(app);
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'League', slug: 'Not A Valid Slug!' })
        .expect(400);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/organizations')
        .send({ name: 'League', slug: `anon-${Date.now()}` })
        .expect(401);
    });
  });
});
