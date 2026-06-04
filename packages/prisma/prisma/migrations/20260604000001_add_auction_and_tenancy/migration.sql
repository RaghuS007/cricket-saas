-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('T20', 'T10', 'TENNIS_BALL');

-- CreateEnum
CREATE TYPE "AuctionLotStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SOLD', 'UNSOLD');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "primaryColor" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'DRAFT',
    "format" "MatchFormat" NOT NULL,
    "purseSizePerTeam" DECIMAL(14,2) NOT NULL,
    "maxSquadSize" INTEGER NOT NULL,
    "maxOverseasPerSquad" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionTeam" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "remainingPurse" DECIMAL(14,2) NOT NULL,
    "playersAcquired" INTEGER NOT NULL DEFAULT 0,
    "overseasAcquired" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuctionTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionLot" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "lotNumber" INTEGER NOT NULL,
    "status" "AuctionLotStatus" NOT NULL DEFAULT 'PENDING',
    "soldToTeamId" TEXT,
    "soldPrice" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionLotId" TEXT NOT NULL,
    "auctionTeamId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "organizationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE INDEX "UserProfile_organizationId_idx" ON "UserProfile"("organizationId");

-- CreateIndex
CREATE INDEX "Player_organizationId_idx" ON "Player"("organizationId");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_shortName_key" ON "Team"("organizationId", "shortName");

-- CreateIndex
CREATE INDEX "Auction_organizationId_idx" ON "Auction"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionTeam_auctionId_teamId_key" ON "AuctionTeam"("auctionId", "teamId");

-- CreateIndex
CREATE INDEX "AuctionTeam_auctionId_idx" ON "AuctionTeam"("auctionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionLot_auctionId_playerId_key" ON "AuctionLot"("auctionId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionLot_auctionId_lotNumber_key" ON "AuctionLot"("auctionId", "lotNumber");

-- CreateIndex
CREATE INDEX "AuctionLot_auctionId_status_idx" ON "AuctionLot"("auctionId", "status");

-- CreateIndex
CREATE INDEX "Bid_auctionLotId_createdAt_idx" ON "Bid"("auctionLotId", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_auctionTeamId_idx" ON "Bid"("auctionTeamId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionTeam" ADD CONSTRAINT "AuctionTeam_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionTeam" ADD CONSTRAINT "AuctionTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_soldToTeamId_fkey" FOREIGN KEY ("soldToTeamId") REFERENCES "AuctionTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionLotId_fkey" FOREIGN KEY ("auctionLotId") REFERENCES "AuctionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionTeamId_fkey" FOREIGN KEY ("auctionTeamId") REFERENCES "AuctionTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
