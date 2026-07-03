// Runs once per Jest worker before any e2e test file. Points the app at an
// isolated Postgres *schema* (not a new database — the `cricket` role isn't
// granted CREATEDB) so e2e tests never touch the real dev data in `public`.
process.env.DATABASE_URL =
  'postgresql://cricket:cricket_dev_password@localhost:5432/cricket_db?schema=test';
process.env.JWT_SECRET = 'e2e-test-secret-not-for-production-use';
process.env.FRONTEND_URL = 'http://localhost:3001';
// Most spec files share one app instance across dozens of tests, each of
// which may call /auth/register — well above what the production threshold
// (10/60s) allows. The dedicated rate-limit test overrides this back down
// to a small value for its own isolated app instance.
process.env.AUTH_RATE_LIMIT_MAX = '1000';
