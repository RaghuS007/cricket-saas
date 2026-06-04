import { io, Socket } from 'socket.io-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

let socket: Socket | null = null

export function getAuctionSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(`${API_URL}/auction`, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  })
  return socket
}

export function disconnectAuctionSocket() {
  socket?.disconnect()
  socket = null
}

// ── Event names (keeps client and server in sync) ────────────────────────────
export const AUCTION_EVENTS = {
  // Client → Server
  JOIN: 'join-auction',
  LEAVE: 'leave-auction',
  BID: 'place-bid',
  // Server → Client
  STATUS: 'auction:status',
  LOT_STARTED: 'auction:lot-started',
  BID_PLACED: 'auction:bid',
  LOT_SOLD: 'auction:lot-sold',
  LOT_UNSOLD: 'auction:lot-unsold',
} as const
