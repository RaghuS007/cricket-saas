# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cricket SaaS — an IPL-style fantasy auction platform with real-time live bidding (Socket.IO) and ball-by-ball scoring. Turborepo + pnpm monorepo:

- `apps/api` — NestJS 11 backend (port 3000): REST + WebSocket, Prisma 6, PostgreSQL 16
- `apps/web` — Next.js 16 App Router frontend (port 3001): Tailwind v4, shadcn/ui (base-nova)
- `packages/prisma` — shared Prisma schema, migrations, and seed script

Auth is custom JWT (bcrypt + jsonwebtoken), stored as a non-HttpOnly cookie on the frontend (`auth-token`) since the browser calls the NestJS API directly rather than through a Next.js BFF proxy.

## Commands

Run from repo root unless noted. `pnpm --filter <app>` targets a single workspace.

```bash
pnpm install                      # install all workspace deps

# Dev servers (run API and web in separate terminals)
pnpm --filter api start:dev       # NestJS, port 3000, watch mode
pnpm --filter web dev             # Next.js, port 3001

# Build / lint / test across the monorepo (turbo)
pnpm build
pnpm lint
pnpm test

# API unit tests (Jest, rootDir apps/api/src, pattern *.spec.ts)
pnpm --filter api test
pnpm --filter api test:watch
pnpm --filter api test:cov
# Run a single unit test file:
cd apps/api && npx jest src/teams/teams.service.spec.ts

# API e2e tests (Jest, apps/api/test/*.e2e-spec.ts) — needs Postgres running
# and the `test` schema (see test/jest-setup-env.js); maxWorkers 1.
pnpm --filter api test:e2e
cd apps/api && npx jest --config ./test/jest-e2e.json test/teams.e2e-spec.ts

# Type-check without emitting
apps/api/node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json

# Prisma (run from packages/prisma)
cd packages/prisma && npx prisma db push        # sync schema to Postgres
cd packages/prisma && npx prisma generate        # regenerate client after schema change
cd packages/prisma && npx prisma studio          # visual DB browser
cd packages/prisma && node_modules/.bin/tsx prisma/seed.ts   # idempotent seed (8 IPL teams, 24 players)
```

Infra: `docker compose up -d` starts Postgres 16 (`cricket-postgres`) and Redis 7 (`cricket-redis`) for local dev.

**WSL2 note**: this repo is developed from Windows via WSL2. Always work inside the WSL2 filesystem (`~/...`), not `/mnt/c/...` — the Windows-mounted drive is slow and breaks file watchers for Next.js/NestJS.

## Architecture

### Multi-tenancy

Every domain resource hangs off `Organization` (the tenant root) via `organizationId`. A user gets an org via `POST /organizations` (onboarding flow) and must belong to one before creating auctions. `Player` and `Team` are special: `organizationId = null` means global seed data visible to *every* org (the 8 IPL teams + 24 players); `organizationId = <id>` means an org's private custom record. Almost every service method starts by resolving `orgId` from the JWT user id (`UserProfile.organizationId`) and then scopes every query with `{ OR: [{ organizationId: null }, { organizationId: orgId }] }` (read) or `{ organizationId: orgId }` (write) — never trust an id path param alone. `TeamsService`/`AuctionService` both implement this `getOrgId(userId)` pattern independently; follow the same shape when adding a new scoped resource rather than trusting `findUnique({ where: { id } })` without an org filter.

### Auth

- Global `JwtAuthGuard` is registered as `APP_GUARD` in `app.module.ts` — every HTTP route requires a valid bearer JWT by default. Opt a route/controller out with `@Public()` (`auth/public.decorator.ts`).
- `@CurrentUser()` decorator injects `{ id, email }` from the validated JWT payload.
- The Socket.IO gateway (`auction/auction.gateway.ts`) authenticates independently in `afterInit`'s middleware — it verifies the same JWT from `socket.handshake.auth.token` manually (not via the Nest guard), since gateways sit outside the HTTP guard pipeline.
- `AuthRateLimitGuard` (`common/rate-limit.guard.ts`) is an in-memory per-IP fixed-window limiter applied to auth endpoints; thresholds are read from env at construction (not module load) specifically so e2e tests can raise the ceiling via `AUTH_RATE_LIMIT_MAX` without weakening the production default.

### Auction state machine

`Auction.status`: `DRAFT → LIVE ⇄ PAUSED → COMPLETED`. Teams and lots can only be added/removed while `DRAFT`; starting requires ≥2 teams and ≥1 lot. Within a `LIVE` auction, `AuctionLot.status` moves `PENDING → IN_PROGRESS → SOLD | UNSOLD`, one lot `IN_PROGRESS` at a time (`startNextLot` enforces this).

Bidding and selling (`AuctionService.placeBid` / `sellLot`) both open a Prisma `$transaction` and take `SELECT ... FOR UPDATE` on the `AuctionLot` row first, to serialize concurrent WebSocket bid/sell attempts against the same lot — without this lock two simultaneous bids could both read the same "current highest" and both get accepted. The sale price is always derived server-side from the highest recorded `Bid`, never taken from the client payload. `sellLot` also enforces purse, max squad size, and max-overseas-per-squad invariants inside the same transaction.

HTTP controllers call into `AuctionService` for state-changing operations, then call `AuctionGateway.broadcastX(...)` helpers to push the result to the room (`auction:{auctionId}`); the gateway's own `place-bid` WS handler calls `AuctionService.placeBid` directly and emits `auction:bid` itself. Keep both paths (HTTP-triggered broadcast vs. gateway-triggered) in sync when changing payload shapes — see `auction/auction.types.ts` for the shared payload types.

### Error shape

`AllExceptionsFilter` (global) normalizes every thrown error — `HttpException`, known Prisma errors (`P2002` → 409, `P2025` → 404), or anything else — into `{ statusCode, error, message }`. The web client (`lib/api.ts`) assumes this shape when extracting error messages; don't throw raw strings/objects from services that bypass it.

### File uploads (team logos)

`teams/team-logo.storage.ts` configures multer `diskStorage` writing into `uploads/team-logos/` (served statically at `/uploads` via `useStaticAssets` in `main.ts`). MIME type is validated both in multer's `fileFilter` and again via `ParseFilePipeBuilder` in the controller (magic-number sniffing is skipped since `diskStorage` doesn't populate `file.buffer`). `TeamsService.updateLogo` best-effort deletes the previous logo file on replace; the controller best-effort deletes the newly-uploaded file if the service call rejects (e.g. ownership check fails), to avoid orphaned files.

### Frontend

- `lib/api.ts` — thin fetch wrappers (`apiGet/apiPost/apiPatch/apiDelete/apiUpload`) that attach the bearer token and normalize errors from the filter shape above. `assetUrl()` prefixes host-relative upload paths (e.g. team logos) with `NEXT_PUBLIC_API_URL` since the API and web app run on different origins/ports.
- `lib/auth.ts` (client-side cookie read/write) vs `lib/auth-server.ts` (Server Component/Route Handler cookie read via `next/headers`) — use the right one depending on whether the code runs in a Client or Server Component.
- `middleware.ts` gates all routes except `/login`, `/register`, `/onboarding` behind the `auth-token` cookie's presence (not validity — the API still enforces the JWT itself).
- Route groups: `(auth)` for login/register/onboarding (no shell chrome), `(dashboard)` for the authenticated app shell.
- `lib/auction-socket.ts` wraps the Socket.IO client for the `/auction` namespace used by `auction-room.tsx`.

### Prisma schema

Single shared schema at `packages/prisma/prisma/schema.prisma`, consumed by `apps/api` via `@prisma/client`. Decimal fields (`basePrice`, `purseSizePerTeam`, `remainingPurse`, `soldPrice`, `Bid.amount`) use `@db.Decimal` and must be compared/manipulated with the Prisma `Decimal` type (`import { Decimal } from '@prisma/client/runtime/library'`), not plain JS numbers, to avoid float rounding on money values.
