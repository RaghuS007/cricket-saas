# CLAUDE.md Audit

## Audit Scope

This audit used `CLAUDE.md` as the primary source and verified only key details against targeted files: root/package manifests, Docker Compose, API bootstrap/module/controllers/services/gateway, Prisma schema, web middleware/lib helpers/routes, env examples, and API test config.

## Confirmed From Repo

- Project is a pnpm + Turborepo monorepo with `apps/api`, `apps/web`, and `packages/prisma`.
- API uses NestJS 11, Prisma 6, PostgreSQL, Socket.IO, and Jest.
- Web uses Next.js 16 App Router, React 19, Tailwind v4 dependencies, and Socket.IO client.
- Docker Compose starts `cricket-postgres` on Postgres 16 and `cricket-redis` on Redis 7.
- `apps/api/src/app.module.ts` registers `JwtAuthGuard` globally through `APP_GUARD`.
- `@Public()` is used for root/health and auth register/login endpoints.
- Auth endpoints use `AuthRateLimitGuard`.
- `apps/api/src/main.ts` enables CORS, global validation, global exception filter, static `/uploads`, and Socket.IO adapter.
- Socket.IO gateway uses namespace `/auction` and verifies JWT from `socket.handshake.auth.token`.
- Multi-tenancy model in Prisma matches `Organization`, `UserProfile`, `Team`, `Player`, `Auction`, `AuctionTeam`, `AuctionLot`, and `Bid`.
- `Team` and `Player` support `organizationId = null` global data and org-specific custom records.
- Auction service resolves org id from the user and scopes auction access by organization.
- Bidding and selling use Prisma transactions and row locks on `AuctionLot`.
- Sale price is derived server-side from recorded bids or base price.
- Decimal money fields exist in Prisma and API code uses Prisma `Decimal` in auction logic.
- `AllExceptionsFilter` returns normalized `{ statusCode, error, message }` responses.
- Frontend `api.ts` attaches bearer tokens and reads normalized error messages.
- Frontend middleware gates routes by `auth-token` cookie presence.
- Route groups `(auth)` and `(dashboard)` exist under `apps/web/src/app`.
- API unit and e2e test commands in `CLAUDE.md` align with package scripts/config.

## From CLAUDE.md Only

- Ball-by-ball scoring was not verified in targeted files.
- The WSL2 workflow recommendation was not verified from code, but matches `README.md`.
- shadcn/ui base-nova usage was not deeply verified beyond frontend dependencies/config presence.

## Possibly Outdated Or Incomplete

- `CLAUDE.md` documents team logo uploads but does not mention the parallel player photo upload flow now present in `apps/api/src/players/`.
- `CLAUDE.md` says `AllExceptionsFilter` maps Prisma `P2002` and `P2025`; current code also handles `P2003` as a conflict fallback.
- `README.md` API reference omits current Teams CRUD endpoints, Players update/delete/photo endpoints, and Teams logo endpoint.
- `README.md` says player photos can be updated through `PATCH /players/:id` with a hosted image URL, but current code also has local upload endpoint `POST /players/:id/photo`.
- Redis is listed in local infra, but this audit did not find or verify runtime Redis usage.

## Not Confirmed

- Deployment configuration or production hosting strategy.
- CI/CD commands or pipelines.
- Complete frontend behavior of auction room components.
- Complete seed data counts beyond documentation claims; `seed.ts` was not opened in this audit.
- Whether `COMPLETED` auction status is currently reachable through an API endpoint.

## Important Missing Details From CLAUDE.md

- `apps/api/.env.example` and `apps/web/.env.example` variable names.
- Player photo upload storage, endpoint, cleanup, and validation behavior.
- Teams and Players now have create/update/delete endpoints, not just list/create.
- API e2e tests use a separate Postgres schema named `test` via `apps/api/test/jest-setup-env.js`.
- Web package has no explicit `test` or `lint` scripts in `apps/web/package.json`.

## Recommended Updates To CLAUDE.md

- Add a short section for player photo uploads mirroring the team logo notes.
- Expand the API endpoint summary for Teams and Players or point readers to controllers for the full current list.
- Mention `P2003` handling in the global exception filter.
- Clarify Redis status: used by future work, unused currently, or used in files not covered by this audit.
- Clarify current status of ball-by-ball scoring modules/routes.
- Add env example file paths and safe variable-name summary.
