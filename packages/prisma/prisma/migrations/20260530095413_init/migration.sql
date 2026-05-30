-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('BAT', 'BOWL', 'ALL_ROUNDER', 'WICKET_KEEPER');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PlayerRole" NOT NULL,
    "country" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "isOverseas" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);
