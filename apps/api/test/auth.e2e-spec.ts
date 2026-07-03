import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { sign } from 'jsonwebtoken';
import { createTestApp, uniqueEmail } from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('registers a new user', async () => {
      const email = uniqueEmail();
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user.email).toBe(email);
    });

    it('rejects a duplicate email', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123' }).expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(409);
      expect(res.body.message).toMatch(/already registered/i);
    });

    it('rejects a malformed email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });

    it('rejects a password under 8 characters', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'short' })
        .expect(400);
    });

    it('rejects a password over the bcrypt-safe 72 char limit', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'x'.repeat(73) })
        .expect(400);
    });

    it('rejects missing required fields', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({}).expect(400);
    });

    it('rejects unknown extra fields (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'password123', role: 'ADMIN' })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toMatch(/role/);
    });

    it('accepts unicode and emoji in the display name', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'password123', displayName: '田中さん 🏏🔥' })
        .expect(201);
      expect(res.body.accessToken).toBeTruthy();
    });

    it('rejects a display name over 100 chars', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'password123', displayName: 'x'.repeat(101) })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with correct credentials', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123' }).expect(201);

      // Nest defaults POST handlers to 201; login has no @HttpCode(200) override.
      const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'password123' }).expect(201);
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('rejects a nonexistent user without revealing that distinction', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail(), password: 'password123' })
        .expect(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('rejects a wrong password with the same message as an unknown user', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123' }).expect(201);

      const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'wrong-password' }).expect(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('rejects malformed request bodies', async () => {
      await request(app.getHttpServer()).post('/auth/login').send({ email: 'nope' }).expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user for a valid token', async () => {
      const email = uniqueEmail();
      const reg = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123' });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .expect(200);
      expect(res.body.email).toBe(email);
    });

    it('rejects a missing Authorization header', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('rejects a malformed token', async () => {
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer not-a-real-jwt').expect(401);
    });

    it('rejects an expired token', async () => {
      const expired = sign({ sub: 'user-x', email: 'x@example.com' }, 'e2e-test-secret-not-for-production-use', {
        expiresIn: '-10s',
      });
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it('rejects a token signed with the wrong secret', async () => {
      const forged = sign({ sub: 'user-x', email: 'x@example.com' }, 'not-the-real-secret', { expiresIn: '1h' });
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
    });
  });

  describe('rate limiting', () => {
    it('throttles repeated login attempts from the same client', async () => {
      const previous = process.env.AUTH_RATE_LIMIT_MAX;
      process.env.AUTH_RATE_LIMIT_MAX = '10'; // production default, isolated to this app instance
      const rateLimitedApp = await createTestApp();
      process.env.AUTH_RATE_LIMIT_MAX = previous; // restore immediately so other apps aren't affected
      try {
        const attempts = await Promise.all(
          Array.from({ length: 11 }, () =>
            request(rateLimitedApp.getHttpServer())
              .post('/auth/login')
              .send({ email: uniqueEmail(), password: 'password123' }),
          ),
        );
        const statuses = attempts.map((r) => r.status).sort((a, b) => a - b);
        expect(statuses).toContain(429);
        expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
      } finally {
        await rateLimitedApp.close();
      }
    });
  });
});
