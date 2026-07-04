# Repo Map

## Root

- `CLAUDE.md`: primary AI/project guide. Read first.
- `README.md`: setup, first-run flow, API and WebSocket overview.
- `package.json`: root Turbo scripts: `build`, `dev`, `lint`, `test`.
- `pnpm-workspace.yaml`: workspaces: `apps/*`, `packages/*`.
- `pnpm-lock.yaml`: lockfile. Do not open unless dependency debugging requires it.
- `docker-compose.yml`: local Postgres 16 and Redis 7.
- `docs/ai-reference/`: Codex/AI continuation references.

## API: `apps/api`

- `apps/api/package.json`: Nest scripts, Jest config, API dependencies.
- `apps/api/src/main.ts`: app bootstrap, CORS, static uploads, WebSocket adapter, validation, global exception filter.
- `apps/api/src/app.module.ts`: modules and global `JwtAuthGuard`.
- `apps/api/src/app.controller.ts`: public root and health routes.
- `apps/api/src/prisma.service.ts`, `apps/api/src/prisma.module.ts`: Prisma wiring.
- `apps/api/src/common/all-exceptions.filter.ts`: normalized API error shape.
- `apps/api/src/common/rate-limit.guard.ts`: auth endpoint rate limiting.
- `apps/api/src/auth/`: register/login/me, JWT strategy/guard, decorators.
- `apps/api/src/organization/`: onboarding org creation and current org lookup.
- `apps/api/src/auction/`: auction REST controller, service, Socket.IO gateway, DTOs, event payload types.
- `apps/api/src/teams/`: tenant/global teams, CRUD, logo upload.
- `apps/api/src/players/`: tenant/global players, CRUD, photo upload.
- `apps/api/test/`: API e2e specs and e2e Jest setup.

## Web: `apps/web`

- `apps/web/package.json`: Next dev/build/start scripts.
- `apps/web/src/app/`: Next.js App Router pages.
- `apps/web/src/app/(auth)/login/page.tsx`: login.
- `apps/web/src/app/(auth)/register/page.tsx`: registration.
- `apps/web/src/app/(auth)/onboarding/page.tsx`: organization onboarding.
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`: dashboard.
- `apps/web/src/app/(dashboard)/auctions/`: auction list, new auction, auction detail room.
- `apps/web/src/components/`: reusable UI and feature components.
- `apps/web/src/lib/api.ts`: API fetch wrappers and `assetUrl()`.
- `apps/web/src/lib/auth.ts`: client-side token cookie helpers.
- `apps/web/src/lib/auth-server.ts`: server-side token reader.
- `apps/web/src/lib/auction-socket.ts`: Socket.IO client wrapper.
- `apps/web/src/middleware.ts`: auth cookie route gate.

## Prisma Package: `packages/prisma`

- `packages/prisma/package.json`: Prisma and seed scripts.
- `packages/prisma/prisma/schema.prisma`: source of truth for database models/enums.
- `packages/prisma/prisma/seed.ts`: idempotent seed for global teams/players.

## Commonly Edited Files

- Backend feature work: service/controller/DTO/module files under `apps/api/src/<feature>/`.
- Auction behavior: `apps/api/src/auction/auction.service.ts`, `auction.controller.ts`, `auction.gateway.ts`, `auction.types.ts`.
- Frontend API calls: `apps/web/src/lib/api.ts` and relevant route/component files.
- Auth flow: `apps/api/src/auth/*`, `apps/web/src/lib/auth*.ts`, `apps/web/src/middleware.ts`.
- Schema changes: `packages/prisma/prisma/schema.prisma` and `packages/prisma/prisma/seed.ts`.

## Edit Carefully

- `packages/prisma/prisma/schema.prisma`: affects generated client and DB shape.
- `apps/api/src/auction/auction.service.ts`: concurrency, money, and tenant invariants.
- `apps/api/src/auction/auction.gateway.ts`: WebSocket auth and event contract.
- `apps/api/src/common/all-exceptions.filter.ts`: frontend depends on error shape.
- `apps/web/src/lib/api.ts`: shared fetch/error behavior.
- `apps/web/src/middleware.ts`: route access behavior.
- Upload storage files under `teams/` and `players/`: local disk cleanup and path safety.

## Ignore For Context Scans

- `node_modules/`
- `.next/`
- `dist/`
- `coverage/`
- `tsconfig.tsbuildinfo`
- `uploads/` except when debugging upload behavior
- `pnpm-lock.yaml` except dependency/version tasks
- `.env`, `.env.local`, and other secret files
