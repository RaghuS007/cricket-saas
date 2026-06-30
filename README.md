# Cricket SaaS

IPL-style fantasy auction platform with real-time live bidding and ball-by-ball scoring. Built for tennis-ball league organisers and IPL fantasy enthusiasts.

## Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| API | NestJS 11, Prisma 6, PostgreSQL 16, Socket.IO |
| Auth | Custom JWT (bcrypt + jsonwebtoken), cookie-based on frontend |
| Frontend | Next.js 16 App Router, Tailwind v4, shadcn/ui (base-nova) |
| Infra (dev) | Docker Compose (Postgres 16, Redis 7) |

## Repository layout

```
apps/
  api/          NestJS backend (port 3000)
  web/          Next.js frontend (port 3001)
packages/
  prisma/       Shared Prisma schema + seed
```

---

## Setup on Windows + WSL2 (fresh machine)

> These steps get a brand-new Windows machine (e.g. T40 server) fully running.
> On native Linux/macOS, skip to [Native Linux / macOS](#native-linux--macos).

### 1. Enable WSL2

Open **PowerShell as Administrator** and run:

```powershell
wsl --install
```

This installs WSL2 with Ubuntu. Reboot when prompted. After reboot, Ubuntu opens and asks you to create a Linux username + password.

Verify WSL2 is active:

```powershell
wsl --list --verbose
# Ubuntu should show VERSION 2
```

### 2. Install Docker Desktop

1. Download Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/
2. Install it — select **WSL2 backend** when asked (not Hyper-V)
3. Open Docker Desktop → **Settings → Resources → WSL Integration**
4. Enable integration for your Ubuntu distro → **Apply & Restart**

Verify inside the Ubuntu terminal:

```bash
docker --version        # Docker 25+
docker compose version  # Docker Compose v2.x
```

### 3. Install Node.js 20 inside WSL2

Open an Ubuntu terminal (search "Ubuntu" in Start menu):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # v20.x.x
```

### 4. Install pnpm

```bash
npm install -g pnpm@11
pnpm --version  # 11.x.x
```

### 5. Clone the repo

```bash
git clone https://github.com/RaghuS007/cricket-saas.git
cd cricket-saas
```

> **Important**: Always work inside the WSL2 filesystem (`~/` or `/home/<user>/`), not `/mnt/c/...`. The Windows-mounted drive is significantly slower and causes file-watcher issues with Next.js and NestJS.

### 6. Install dependencies

```bash
pnpm install
```

### 7. Start infrastructure (Postgres + Redis)

```bash
docker compose up -d
```

Verify both containers are running:

```bash
docker ps
# Should list cricket-postgres and cricket-redis
```

### 8. Configure environment variables

```bash
cp apps/api/.env.example  apps/api/.env
cp apps/web/.env.example  apps/web/.env.local
```

The docker-compose credentials are already filled in — you only need to generate a `JWT_SECRET`.

Edit `apps/api/.env`:

```env
DATABASE_URL="postgresql://cricket:cricket_dev_password@localhost:5432/cricket_db?schema=public"
JWT_SECRET="<paste output of command below>"
PORT=3000
FRONTEND_URL="http://localhost:3001"
```

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

`apps/web/.env.local` needs no changes — the default is correct:

```env
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

### 9. Push schema + seed database

```bash
cd packages/prisma

# Sync Prisma schema to Postgres
npx prisma db push

# Seed 8 IPL teams + 24 players with avatar URLs (idempotent — safe to re-run)
node_modules/.bin/tsx prisma/seed.ts

cd ../..
```

### 10. Start the apps

Open two Ubuntu terminal tabs (Windows Terminal supports tabs; press Ctrl+Shift+T):

```bash
# Terminal 1 — API (port 3000)
pnpm --filter api start:dev
# Wait for: "Nest application successfully started"

# Terminal 2 — Web (port 3001)
pnpm --filter web dev
# Wait for: "Ready in Xs"
```

Open your Windows browser at **http://localhost:3001** — WSL2 forwards ports automatically.

---

## Native Linux / macOS

Same steps as above but skip sections 1–2.

Install Docker Engine on Ubuntu/Debian:

```bash
sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and back in, then verify: docker ps
```

Then continue from [step 5 (Clone)](#5-clone-the-repo).

---

## First-run flow

1. **Register** at `/register` — email + password + display name
2. **Onboarding** at `/onboarding` — create your league (organization)
3. **Dashboard** shows auction counts by status
4. **New Auction** — set name, format (T20 / T10 / Tennis Ball), purse per team, squad limits
5. **Auction Setup** (DRAFT state):
   - Add up to 8 pre-seeded IPL teams from the dropdown
   - Select players from the scrollable list (avatars, role badges, base prices)
   - Remove teams or players before starting
6. **Start Auction →** — room goes LIVE
7. **Next Player →** — puts the next lot on the block; player photo + role shown
8. Teams bid in real time via WebSocket — the counter animates up, a cash-stack meter rises, `+₹` particles fly on each new bid
9. **Sell ✓** or **Unsold** to conclude each lot; team purse bars update live

---

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
POST   /auctions/:id/lots/:lid/sell    Mark SOLD + deduct purse + update squad counts
POST   /auctions/:id/lots/:lid/unsold  Mark UNSOLD
GET    /auctions/:id/lots/:lid/bids    Bid history for a lot
```

---

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

---

## Multi-tenancy

Every resource is scoped to an `Organization`. Global reference data (IPL teams + players) has `organizationId = null` and is visible to all orgs. A user must belong to an org (via `/onboarding`) before creating auctions.

---

## Player avatars

Players have an `avatarUrl` field. The seed populates it with colour-coded initials via `ui-avatars.com`:

| Role | Colour |
|---|---|
| Batsman (BAT) | Blue |
| Bowler (BOWL) | Green |
| All-Rounder (ALL_ROUNDER) | Purple |
| Wicket-Keeper (WICKET_KEEPER) | Amber |

To use real photos, update the field in Prisma Studio (`npx prisma studio`) or via `PATCH /players/:id` with a hosted image URL (Cloudinary, S3, etc.).

---

## Development commands

```bash
# Type-check API
apps/api/node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json

# Type-check web
apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json

# Prisma Studio (visual DB browser)
cd packages/prisma && npx prisma studio

# Regenerate Prisma client after schema change
cd packages/prisma && npx prisma generate

# Re-seed (idempotent — safe to run multiple times)
cd packages/prisma && node_modules/.bin/tsx prisma/seed.ts

# Run API unit tests
pnpm --filter api test
```

---

## Troubleshooting

**`permission denied` on Docker socket**

```bash
sudo usermod -aG docker $USER
# Log out and back in to WSL2, then retry
```

**`relation does not exist` from Prisma**

Schema hasn't been pushed yet:

```bash
cd packages/prisma && npx prisma db push
```

**`ECONNREFUSED` on API calls from the browser**

The API isn't running. Start it with `pnpm --filter api start:dev` and wait for `Nest application successfully started`.

**`tsx: command not found` when seeding**

Run via the local binary path:

```bash
cd packages/prisma && node_modules/.bin/tsx prisma/seed.ts
```

**WSL2: `localhost` not reachable from Windows browser**

WSL2 auto-forwards ports on Windows 11. If it doesn't work, find the WSL IP and use it directly:

```bash
ip addr show eth0 | grep 'inet '
# Use that IP in the browser: http://<wsl-ip>:3001
```
