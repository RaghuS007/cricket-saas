# Cricket SaaS

IPL-style fantasy auction platform with real-time live bidding and ball-by-ball scoring. Built for tennis-ball league organisers and IPL fantasy enthusiasts.

## Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| API | NestJS 11, Prisma 6, PostgreSQL, Socket.IO |
| Auth | Supabase Auth (email + OAuth), JWT via `passport-jwt` |
| Frontend | Next.js 16 App Router, Tailwind v4, shadcn/ui (base-nova) |
| Infra (dev) | Docker Compose (Postgres 16, Redis 7) |

## Repository layout

```
apps/
  api/          NestJS backend (port 3000)
  web/          Next.js frontend (port 3001)
packages/
  prisma/       Shared Prisma schema, migrations, seed
```

## Getting started

### 1. Prerequisites

- Node.js ≥ 20, pnpm v11
- Docker Desktop (for local Postgres + Redis)

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

Fill in the values (get them from **Supabase Dashboard → Settings → API**):

| File | Key | Where to find it |
|---|---|---|
| `apps/api/.env` | `SUPABASE_JWT_SECRET` | Settings → API → JWT Secret |
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon key |

Also configure in **Supabase Dashboard → Auth → URL Configuration**:
- Site URL: `http://localhost:3001`
- Redirect URLs: `http://localhost:3001/auth/callback`

### 5. Run database migrations + seed

```bash
# Apply schema migrations
cd packages/prisma && npx prisma migrate deploy

# Seed 8 IPL teams + 24 players (global reference data)
npx prisma db seed
```

### 6. Start the apps

```bash
# Terminal 1 — API
pnpm --filter api dev

# Terminal 2 — Web
pnpm --filter web dev
```

Open [http://localhost:3001](http://localhost:3001).

## First-run flow

1. Register with email → confirm the link Supabase sends
2. Redirected to `/onboarding` → create your league (org)
3. `/dashboard` shows auction counts and a link to create your first auction
4. **New Auction** → set format, purse size, squad limits
5. Add teams (8 IPL teams are pre-seeded) and players (24 pre-seeded)
6. **Start Auction** → use "Next Player →" to put players on the block
7. Teams bid in real time via WebSocket — the bid feed updates live for all connected browsers
8. "Sell ✓" or "Unsold" to conclude each lot

## API overview

All endpoints require `Authorization: Bearer <supabase_access_token>` except `GET /` and `GET /health`.

```
# Auth
POST   /auth/sync-profile          Create/update UserProfile from JWT

# Organizations
POST   /organizations               Create org + become OWNER
GET    /organizations/me            Get current user's org

# Players
GET    /players                     List players (org-scoped + global)
POST   /players                     Create player
GET    /players/:id
PATCH  /players/:id
DELETE /players/:id

# Auctions (all org-scoped)
POST   /auctions                    Create auction (DRAFT)
GET    /auctions                    List org's auctions
GET    /auctions/:id                Full auction detail (teams, current lot, bids)
POST   /auctions/:id/start          DRAFT → LIVE
POST   /auctions/:id/pause          LIVE → PAUSED
POST   /auctions/:id/resume         PAUSED → LIVE
POST   /auctions/:id/teams          Register a team
POST   /auctions/:id/lots           Bulk-add players as lots
GET    /auctions/:id/lots           List all lots with status
POST   /auctions/:id/lots/next      Start next PENDING lot (IN_PROGRESS)
POST   /auctions/:id/lots/:id/sell  Mark lot SOLD + deduct purse
POST   /auctions/:id/lots/:id/unsold Mark lot UNSOLD
GET    /auctions/:id/lots/:id/bids  Bid history for a lot
```

## WebSocket (Socket.IO)

Namespace: `/auction` — connect with `{ auth: { token: '<access_token>' } }`.

| Direction | Event | Payload |
|---|---|---|
| Client → Server | `join-auction` | `{ auctionId }` |
| Client → Server | `leave-auction` | `{ auctionId }` |
| Client → Server | `place-bid` | `{ auctionId, lotId, auctionTeamId, amount }` |
| Server → Room | `auction:status` | `{ auctionId, status }` |
| Server → Room | `auction:lot-started` | `{ auctionId, lot: { id, lotNumber, player } }` |
| Server → Room | `auction:bid` | `{ auctionId, lotId, amount, teamName, highestBid }` |
| Server → Room | `auction:lot-sold` | `{ auctionId, lotId, soldPrice, teamName }` |
| Server → Room | `auction:lot-unsold` | `{ auctionId, lotId }` |

## Multi-tenancy

Every resource is scoped to an `Organization`. Global reference data (IPL teams, players) has `organizationId = null` and is visible to all orgs. Auction resources require a non-null `organizationId`.

## Development commands

```bash
# Type-check both apps
npx tsc --noEmit                    # from apps/api or apps/web

# Run API unit tests
pnpm --filter api test

# Prisma Studio (DB browser)
cd packages/prisma && npx prisma studio

# Regenerate Prisma client after schema change
cd packages/prisma && npx prisma generate

# Create a new migration
cd packages/prisma && npx prisma migrate dev --name <migration-name>
```
