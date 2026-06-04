// ── Socket.IO event payloads emitted to auction rooms ──────────────────────

export interface AuctionStatusPayload {
  auctionId: string;
  status: string;
}

export interface AuctionLotStartedPayload {
  auctionId: string;
  lot: {
    id: string;
    lotNumber: number;
    player: {
      id: string;
      name: string;
      role: string;
      country: string | null;
      basePrice: string;
      isOverseas: boolean;
    };
  };
}

export interface AuctionBidPayload {
  auctionId: string;
  lotId: string;
  amount: string;
  auctionTeamId: string;
  teamName: string;
  highestBid: string;
}

export interface AuctionLotSoldPayload {
  auctionId: string;
  lotId: string;
  soldPrice: string;
  auctionTeamId: string;
  teamName: string;
}

export interface AuctionLotUnsoldPayload {
  auctionId: string;
  lotId: string;
}
