# Cricket SaaS

IPL-style fantasy auction platform with real-time live bidding and ball-by-ball scoring. Built for tennis-ball league organisers and IPL fantasy enthusiasts.

## Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| API | NestJS 11, Prisma 6, PostgreSQL, Socket.IO |
| Auth | Custom JWT (bcrypt + jsonwebtoken), cookie-based on frontend |
| Frontend | Next.js 16 App Router, Tailwind v4, shadcn/ui (base-nova) |
| Infra (dev) | Docker Compose (Postgres 16, Redis 7) |

## Repository layout

```
apps/
  api/          NestJS backend (port 3000)
  web/          Next.js frontend (port 3001)
packages/
  prisma/       Shared Prisma schema, seed
```

## Getting started

### 1. Prerequisites

- Node.js ≥ 20, pnpm v11
- Docker Desktop with WSL integration enabled (for local Postgres + Redis)

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start infrastructure

```bash
docker compose up -d
```

### 4. Configure environment variables

```bash
cp apps/api/.env.example  apps/api/.env
cp apps/web/.env.example  apps/web/.env.local
```

| File | Key | Description |
|---|---|---|
| `apps/api/.env` | `DATABASE_URL` | Postgres connection string |
| `apps/api/.env` | `JWT_SECRET` | Secret used to sign access tokens (generate with `node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"`) |
| `apps/api/.env` | `FRONTEND_URL` | CORS origin, defaults to `http://localhost:3001` |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` | NestJS API base URL, defaults to `http://localhost:3000` |

### 5. Push schema + seed

```bash
cd packages/prisma

# Sync schema to database
npx prisma db push

# Seed 8 IPL teams + 24 players (with avatar URLs)
node_modules/.bin/tsx prisma/seed.ts
```

### 6. Start the apps

```bash
# Terminal 1 — API (port 3000)
pnpm --filter api start:dev

# Terminal 2 — Web (port 3001)
pnpm --filter web dev
```

Open [http://localhost:3001](http://localhost:3001).

## First-run flow

1. **Register** at `/register` with email + password
2. **Onboarding** at `/onboarding` — create your league (organization)
3. **Dashboard** shows live / draft / completed auction counts
4. **New Auction** → name, format (T20 / T10 / Tennis Ball), purse per team, squad limits
5. **Auction Setup** (DRAFT state):
   - Add up to 8 pre-seeded IPL teams from the dropdown
   - Select players from the scrollable list (avatars, role badges, base prices shown)
   - Remove teams or players before starting
6. **Start Auction** → room goes LIVE
7. **Next Player →** puts the next lot on the block; player photo + role displayed
8. Teams bid in real time via WebSocket — the bid counter animates up, a cash-stack meter rises, and `+₹` particles fly on each bid
9. **Sell ✓** (sold to highest bidder) or **Unsold** to conclude each lot; team purse bars update live

## API reference

All endpoints require `Authorization: Bearer <access_token>` except `POST /auth/register`, `POST /auth/login`, `GET /`, and `GET /health`.

```
# Auth
POST   /auth/register              Register (email, password, displayName)
POST   /auth/login                 Login → { accessToken }
GET    /auth/me                    Current user identity

# Organizations
POST   /organizations              Create org + become OWNER
GET    /organizations/me           Current user's org

# Teams
GET    /teams                      List global IPL teams + org-specific teams

# Players
GET    /players                    List global + org players (with avatarUrl)
POST   /players                    Create custom player

# Auctions (all org-scoped via JWT)
POST   /auctions                   Create auction (DRAFT)
GET    /auctions                   List org's auctions
GET    /auctions/:id               Full detail (teams, current lot, lot counts)
POST   /auctions/:id/start         DRAFT → LIVE  (needs ≥2 teams, ≥1 lot)
POST   /auctions/:id/pause         LIVE → PAUSED
POST   /auctions/:id/resume        PAUSED → LIVE
POST   /auctions/:id/teams         Add a team to a DRAFT auction
DELETE /auctions/:id/teams/:tid    Remove a team from a DRAFT auction
POST   /auctions/:id/lots          Bulk-add players as lots to a DRAFT auction
GET    /auctions/:id/lots          List lots with status, player, sold-to team
DELETE /auctions/:id/lots/:lid     Remove a lot from a DRAFT auction
POST   /auctions/:id/lots/next     Start next PENDING lot → IN_PROGRESS
POST   /auctions/:id/lots/:lid/sell   Mark SOLD + deduct purse + update squad counts
POST   /auctions/:id/lots/:lid/unsold Mark UNSOLD
GET    /auctions/:id/lots/:lid/bids   Bid history for a lot
```

## WebSocket (Socket.IO)

Namespace: `/auction` — authenticate via `{ auth: { token: '<access_token>' } }` in the handshake.

| Direction | Event | Payload |
|---|---|---|
| Client → Server | `join-auction` | `{ auctionId }` |
| Client → Server | `leave-auction` | `{ auctionId }` |
| Client → Server | `place-bid` | `{ auctionId, lotId, auctionTeamId, amount }` |
| Server → Room | `auction:status` | `{ auctionId, status }` |
| Server → Room | `auction:lot-started` | `{ auctionId, lot: { id, lotNumber, player } }` |
| Server → Room | `auction:bid` | `{ auctionId, lotId, amount, teamName, highestBid }` |
| Server → Room | `auction:lot-sold` | `{ auctionId, lotId, soldPrice, auctionTeamId, teamName }` |
| Server → Room | `auction:lot-unsold` | `{ auctionId, lotId }` |

## Multi-tenancy

Every resource is scoped to an `Organization`. Global reference data (IPL teams + players) has `organizationId = null` and is visible to all orgs. A user must belong to an org (via `/onboarding`) before creating auctions or accessing player lots.

## Player avatars

Players have an `avatarUrl` field. The seed populates it with colour-coded initials via `ui-avatars.com` (blue = BAT, green = BOWL, purple = AR, amber = WK). To use real photos, update the field directly in Prisma Studio or via a `PATCH /players/:id` call with a hosted image URL (Cloudinary, S3, etc.).

## Development commands

```bash
# Type-check API
/home/raghu/projects/cricket-saas/apps/api/node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json

# Type-check web
/home/raghu/projects/cricket-saas/apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json

# Prisma Studio (visual DB browser)
cd packages/prisma && npx prisma studio

# Regenerate Prisma client after schema change
cd packages/prisma && npx prisma generate

# Re-seed (idempotent — safe to run multiple times)
cd packages/prisma && node_modules/.bin/tsx prisma/seed.ts

# Run API unit tests
pnpm --filter api test
```
