-- The auction enums + tables (AuctionStatus, MatchFormat, AuctionLotStatus,
-- Team, Auction, AuctionTeam, AuctionLot, Bid) were already applied to the DB
-- from an earlier migration that was replaced.  This migration only adds the
-- multi-tenancy delta on top of that existing state.

-- ── New enum ────────────────────────────────────────────────────────────────
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- ── New tables ──────────────────────────────────────────────────────────────
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "organizationId" TEXT,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- ── Indexes on new tables ───────────────────────────────────────────────────
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");
CREATE INDEX "UserProfile_organizationId_idx" ON "UserProfile"("organizationId");

-- ── Player: add org scope (null = global IPL seed data) ─────────────────────
ALTER TABLE "Player" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "Player_organizationId_idx" ON "Player"("organizationId");

-- ── Team: add org scope + replace global shortName unique with per-org unique
ALTER TABLE "Team" ADD COLUMN "organizationId" TEXT;
DROP INDEX "Team_shortName_key";
CREATE UNIQUE INDEX "Team_organizationId_shortName_key" ON "Team"("organizationId", "shortName");
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- ── Auction: add org scope + creator (safe: no rows in fresh dev DB) ────────
ALTER TABLE "Auction" ADD COLUMN "organizationId" TEXT NOT NULL;
ALTER TABLE "Auction" ADD COLUMN "createdById" TEXT NOT NULL;
CREATE INDEX "Auction_organizationId_idx" ON "Auction"("organizationId");

-- ── Foreign keys for new columns ────────────────────────────────────────────
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Player" ADD CONSTRAINT "Player_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Auction" ADD CONSTRAINT "Auction_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Auction" ADD CONSTRAINT "Auction_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
