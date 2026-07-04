# Development Notes

## Run Locally

1. Install dependencies from repo root: `pnpm install`.
2. Copy env examples: `apps/api/.env.example` to `apps/api/.env`, `apps/web/.env.example` to `apps/web/.env.local`.
3. Set `JWT_SECRET` in `apps/api/.env`; do not commit secrets.
4. Start infra: `docker compose up -d`.
5. From `packages/prisma`, run `npx prisma db push` and `node_modules/.bin/tsx prisma/seed.ts`.
6. Start API: `pnpm --filter api start:dev`.
7. Start web: `pnpm --filter web dev`.
8. Open `http://localhost:3001`.

## Add A New Feature

- Start with `CLAUDE.md` and `docs/ai-reference/CODEX_CONTEXT.md`.
- Identify whether the feature is frontend-only, API-only, DB-backed, or real-time.
- Inspect only the closest existing feature files and follow their patterns.
- For tenant data, resolve the user's org from JWT user id and scope all reads/writes by organization.
- Prefer end-to-end tests for product behavior where practical.

## Frontend Changes

- Use Next.js App Router files under `apps/web/src/app`.
- Keep route group conventions: `(auth)` for login/register/onboarding and `(dashboard)` for authenticated app pages.
- Use `apps/web/src/lib/api.ts` for backend calls so auth headers and error handling stay consistent.
- Use `apps/web/src/lib/auth.ts` only in client components and `apps/web/src/lib/auth-server.ts` in server contexts.
- Use `assetUrl()` for upload paths returned as `/uploads/...`.
- Preserve existing design system/components before introducing new UI patterns.

## Backend/API Changes

- Add or change routes in the relevant controller under `apps/api/src/<feature>/`.
- Put domain rules in services, not controllers.
- Use DTOs with validation decorators; global validation strips unknown fields and forbids non-whitelisted fields.
- Keep routes protected by default; add `@Public()` only when intentionally unauthenticated.
- Return normal Nest exceptions so `AllExceptionsFilter` can normalize responses.
- For auction changes, keep HTTP controller broadcasts and WebSocket gateway payloads aligned.

## Database Logic

- Edit `packages/prisma/prisma/schema.prisma` for model changes.
- Use Prisma `Decimal` for money fields and import from `@prisma/client/runtime/library` in API code.
- After schema changes, run Prisma generation and synchronize the DB as appropriate.
- Update `packages/prisma/prisma/seed.ts` if global reference data changes.
- Respect global data convention: `organizationId = null` means shared seed data for teams/players.

## Testing Changes

- API unit tests: `pnpm --filter api test`.
- API e2e tests: `pnpm --filter api test:e2e`; requires Postgres running.
- Single e2e test example: from `apps/api`, run `npx jest --config ./test/jest-e2e.json test/teams.e2e-spec.ts`.
- Type-check API: `apps/api/node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json`.
- Type-check web: `apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json`.
- Root commands use Turbo: `pnpm build`, `pnpm lint`, `pnpm test`.

## Debug Common Issues

- Prisma `relation does not exist`: run `npx prisma db push` from `packages/prisma`.
- Browser `ECONNREFUSED`: API is not running or `NEXT_PUBLIC_API_URL` is wrong.
- E2E DB failures: ensure Docker Postgres is running and port `5432` is free.
- Auth failures: verify `JWT_SECRET` is set and frontend has `auth-token` cookie.
- WebSocket auth failures: confirm the Socket.IO client passes token in `handshake.auth.token`.
- Uploaded images missing: check API static serving from `uploads/` and frontend `assetUrl()` usage.

## Project Conventions

- Use pnpm, not npm or yarn.
- Keep code changes minimal and task-focused.
- Prefer targeted file inspection over broad scans.
- Do not modify app code for documentation-only tasks.
- Do not commit or print secret values.
- Keep frontend and backend API contracts synchronized.
- For product behavior validation, prefer e2e tests when feasible.

## Common Mistakes To Avoid

- Using `findUnique({ where: { id } })` for tenant-owned resources without org scoping.
- Editing global seed teams/players through tenant-specific update/delete flows.
- Using JS number math for Prisma Decimal money fields.
- Changing auction WebSocket payloads without updating HTTP broadcast callers and frontend listeners.
- Adding `Content-Type` manually for `FormData` uploads.
- Assuming middleware validates JWTs; it only checks cookie presence.
- Opening `pnpm-lock.yaml`, `.next`, or `node_modules` for general context.
