// ── Shared frontend types ────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
  shortName: string
  primaryColor: string | null
  logoUrl: string | null
  organizationId: string | null
}

export type MatchFormat = 'T20' | 'T10' | 'TENNIS_BALL'
export type AuctionStatus = 'DRAFT' | 'LIVE' | 'PAUSED' | 'COMPLETED'
export type AuctionLotStatus = 'PENDING' | 'IN_PROGRESS' | 'SOLD' | 'UNSOLD'

export interface Auction {
  id: string
  name: string
  status: AuctionStatus
  format: MatchFormat
  purseSizePerTeam: string
  maxSquadSize: number
  maxOverseasPerSquad: number
  createdAt: string
  _count?: { auctionTeams: number; auctionLots: number }
}

export interface AuctionTeam {
  id: string
  teamId: string
  remainingPurse: string
  playersAcquired: number
  overseasAcquired: number
  team: { id: string; name: string; shortName: string; primaryColor: string | null; logoUrl: string | null }
}

export interface Player {
  id: string
  name: string
  role: string
  country: string | null
  basePrice: string
  isOverseas: boolean
  avatarUrl: string | null
  organizationId?: string | null
}

export interface AuctionLot {
  id: string
  lotNumber: number
  status: AuctionLotStatus
  soldPrice: string | null
  player: Player
  soldToTeam?: { team: { name: string } } | null
}

export interface CurrentLot {
  id: string
  lotNumber: number
  status: AuctionLotStatus
  player: Player
  bids: Array<{
    amount: string
    auctionTeam: { team: { name: string } }
  }>
}

export interface AuctionDetail extends Auction {
  auctionTeams: AuctionTeam[]
  currentLot: CurrentLot | null
  lotCounts: Array<{ status: AuctionLotStatus; _count: number }>
}

// ── Socket event payloads ─────────────────────────────────────────────────────

export interface BidPayload {
  auctionId: string
  lotId: string
  amount: string
  auctionTeamId: string
  teamName: string
  highestBid: string
}

export interface LotStartedPayload {
  auctionId: string
  lot: {
    id: string
    lotNumber: number
    player: Player
  }
}

export interface LotSoldPayload {
  auctionId: string
  lotId: string
  soldPrice: string
  auctionTeamId: string
  teamName: string
}
