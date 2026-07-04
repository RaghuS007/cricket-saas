# Codex Context

## Project Summary

Cricket SaaS is an IPL-style fantasy auction platform with real-time live bidding and planned/available ball-by-ball scoring context. It is a Turborepo + pnpm monorepo with a NestJS API, Next.js frontend, and shared Prisma schema.

Status: `Confirmed from repo` for the monorepo, API, web app, Prisma schema, auth guard, WebSocket auction namespace, local Docker infra, and core auction services. Ball-by-ball scoring was `From CLAUDE.md only` in this audit.

## Tech Stack

- Monorepo: Turborepo + pnpm workspaces, `packageManager: pnpm@11.4.0`.
- API: NestJS 11, Prisma 6, PostgreSQL 16, Socket.IO, Jest.
- Web: Next.js 16 App Router, React 19, Tailwind v4, shadcn/base UI patterns.
- Dev infra: Docker Compose with Postgres 16 and Redis 7.
- Auth: custom JWT with `bcrypt` + `jsonwebtoken`, frontend stores token in `auth-token` cookie.

## Key Architecture Notes

- Multi-tenancy is centered on `Organization`; most domain resources must be scoped through the JWT user's `UserProfile.organizationId`.
- `Team` and `Player` use `organizationId = null` for global seed data and a concrete org id for tenant-owned custom records.
- HTTP auth is global via `JwtAuthGuard` registered as `APP_GUARD`; use `@Public()` only for explicit public routes.
- Socket.IO auction gateway authenticates separately using `socket.handshake.auth.token` in namespace `/auction`.
- Auction state machine: `DRAFT -> LIVE <-> PAUSED -> COMPLETED`; lots move `PENDING -> IN_PROGRESS -> SOLD | UNSOLD`.
- Bidding and selling lock `AuctionLot` rows with `SELECT ... FOR UPDATE`; keep concurrency-sensitive logic inside Prisma transactions.
- Money fields are Prisma `Decimal`; do not use plain JS float math for purse, bids, or prices.
- Global API errors are normalized to `{ statusCode, error, message }`; frontend API wrappers depend on this shape.
- Uploaded files are stored under `uploads/` and served from `/uploads`; current code supports team logos and player photos.

## Important Folders And Files

- `CLAUDE.md`: primary project reference for AI agents.
- `README.md`: setup, first-run flow, API/WebSocket overview.
- `apps/api/src/main.ts`: Nest bootstrap, CORS, static uploads, validation, exception filter.
- `apps/api/src/app.module.ts`: module wiring and global JWT guard.
- `apps/api/src/auth/`: JWT auth, decorators, rate-limit guard usage.
- `apps/api/src/auction/`: auction controller, service, gateway, DTOs, shared WS payload types.
- `apps/api/src/teams/` and `apps/api/src/players/`: tenant-scoped global/custom catalog logic and uploads.
- `apps/web/src/app/`: Next.js route groups and pages.
- `apps/web/src/lib/api.ts`: fetch helpers and asset URL handling.
- `apps/web/src/lib/auth.ts` and `apps/web/src/lib/auth-server.ts`: client/server token helpers.
- `apps/web/src/middleware.ts`: cookie-presence route gate.
- `packages/prisma/prisma/schema.prisma`: shared DB schema.
- `packages/prisma/prisma/seed.ts`: seed script.

## Main Commands

- Install: `pnpm install`
- Dev infra: `docker compose up -d`
- API dev: `pnpm --filter api start:dev`
- Web dev: `pnpm --filter web dev`
- Monorepo build/lint/test: `pnpm build`, `pnpm lint`, `pnpm test`
- API tests: `pnpm --filter api test`
- API e2e tests: `pnpm --filter api test:e2e`
- Type-check API: `apps/api/node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json`
- Type-check web: `apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json`
- Prisma db push: run `npx prisma db push` from `packages/prisma`
- Prisma generate: run `npx prisma generate` from `packages/prisma`
- Seed: run `node_modules/.bin/tsx prisma/seed.ts` from `packages/prisma`

## Development Workflow

- Start from `CLAUDE.md` and this file before exploring.
- For local work, copy env examples to `apps/api/.env` and `apps/web/.env.local`, then set a real `JWT_SECRET`.
- Start Postgres/Redis before API e2e tests or local full-stack testing.
- Keep API and web dev servers in separate terminals.
- Prefer e2e validation for product behavior when feasible.

## Coding Rules

- Use pnpm only.
- Scope every tenant resource by organization; never trust path ids alone.
- Use Prisma `Decimal` for money comparisons and mutations.
- Keep HTTP and WebSocket auction payloads in sync when changing auction behavior.
- Do not change app code when the task is documentation-only.
- Do not expose `.env` secrets; document variable names only.
- Preserve existing Next.js App Router route group patterns.

## Testing Instructions

- API unit tests live under `apps/api/src/**/*.spec.ts` and run with `pnpm --filter api test`.
- API e2e tests live under `apps/api/test/*.e2e-spec.ts`, use `apps/api/test/jest-e2e.json`, and require local Postgres.
- E2E setup points Prisma to the `test` schema and raises auth rate-limit thresholds.
- Web package currently has no `test` or `lint` script in its `package.json`; use TypeScript checks and app-level manual verification unless scripts are added.

## Known Risks Or Incomplete Areas

- `CLAUDE.md` mentions ball-by-ball scoring, but this audit did not verify scoring modules or routes.
- `README.md` API list is shorter than current controllers: Teams and Players now include create/update/delete and image upload endpoints.
- Redis is present in Docker Compose but no targeted code verification found Redis usage.
- Frontend token cookie is intentionally non-HttpOnly because browser code calls the Nest API directly.
- Uploaded files are local disk based; production storage strategy is not documented.

## Files To Inspect First For Common Tasks

- Auth/API access: `apps/api/src/auth/*`, `apps/api/src/app.module.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/middleware.ts`.
- Auction behavior: `apps/api/src/auction/auction.service.ts`, `auction.controller.ts`, `auction.gateway.ts`, `auction.types.ts`, `apps/web/src/lib/auction-socket.ts`.
- Teams/players: `apps/api/src/teams/*`, `apps/api/src/players/*`, relevant web pages/components under `apps/web/src/app/(dashboard)` and `apps/web/src/components`.
- Database changes: `packages/prisma/prisma/schema.prisma`, existing migrations if present, `packages/prisma/prisma/seed.ts`.
- Frontend API calls: `apps/web/src/lib/api.ts`, relevant route page in `apps/web/src/app`.

## Token-Saving Rules For Codex

- Read `CLAUDE.md` first, then this file.
- Use targeted `rg`/glob searches for the specific task; avoid full repo scans.
- Do not open lockfiles, generated folders, `.next`, `node_modules`, `dist`, coverage, or large build output unless necessary.
- Prefer file paths and short summaries over copying code into notes.
- Verify only claims that affect the task; mark uncertain facts instead of guessing.
- Ask before large refactors or architecture changes.

## Source Summary

From `CLAUDE.md`: project purpose, main stack, commands, multi-tenancy model, auth flow, auction state machine, transaction/locking rules, error shape, team logo upload notes, frontend route/helper notes, Prisma Decimal guidance.

Verified directly from repo: package/workspace manifests, Docker Compose services, API bootstrap/module guard, Prisma schema, auth/organization/auction/teams/players controllers and services, Socket.IO gateway authentication/events, frontend middleware and API/auth helpers, route page locations, env example variable names, API unit/e2e test configuration.

## Context to paste in future Codex sessions

Read `CLAUDE.md` and `docs/ai-reference/CODEX_CONTEXT.md` first. Treat them as the primary repo context and inspect only files directly relevant to the requested task. This is a pnpm Turborepo with `apps/api` NestJS 11, `apps/web` Next.js 16, and `packages/prisma` Prisma/PostgreSQL schema. Preserve tenant scoping through `Organization`, use Prisma `Decimal` for money, keep HTTP and Socket.IO auction payloads in sync, and avoid touching generated folders or secrets. Do not full-scan the repo unless the task truly requires it. Confirm before large refactors or architecture changes. When done, summarize files changed, important behavior changes, and exact test/type-check commands to run.
