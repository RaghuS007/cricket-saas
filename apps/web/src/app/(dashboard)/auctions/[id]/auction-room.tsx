'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { apiPatch, apiPost, assetUrl } from '@/lib/api'
import { getAuctionSocket, AUCTION_EVENTS, disconnectAuctionSocket } from '@/lib/auction-socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AuctionInsights } from './auction-insights'
import type {
  AuctionDetail,
  AuctionStatus,
  AuctionTeam,
  BidPayload,
  LotSoldPayload,
  LotStartedPayload,
} from '@/lib/types'

interface Props {
  initial: AuctionDetail
  accessToken: string
}

interface BidFeedItem {
  id: string
  teamName: string
  amount: string
  ts: number
  auctionTeamId?: string
}

interface CashParticle {
  id: string
  x: number   // % from left of container
  delta: string
}

interface ConfettiPiece {
  id: string
  x: number
  dx: number
  dy: number
  rot: number
  color: string
}

interface SoldBanner {
  id: string
  playerName: string
  teamName: string
  soldPrice: string
}

const STATUS_VARIANT: Record<AuctionStatus, 'live' | 'neutral' | 'warning' | 'muted'> = {
  DRAFT: 'neutral',
  LIVE: 'live',
  PAUSED: 'warning',
  COMPLETED: 'muted',
}

const CONFETTI_COLORS = ['var(--primary)', 'var(--gold)', '#38bdf8', '#f472b6']

const FORMATS = [
  { value: 'T20', label: 'T20' },
  { value: 'T10', label: 'T10' },
  { value: 'TENNIS_BALL', label: 'Tennis Ball' },
]

const ROLE_FULL: Record<string, string> = {
  BAT: 'Batsman',
  BOWL: 'Bowler',
  ALL_ROUNDER: 'All-Rounder',
  WICKET_KEEPER: 'Wicket-Keeper',
}

// ── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 600) {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (target === prevRef.current) return
    const from = prevRef.current
    prevRef.current = target
    const start = performance.now()

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out-cubic
      setDisplay(Math.round(from + (target - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return display
}

function playHammerSound() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  const ctx = new AudioContextClass()
  const now = ctx.currentTime
  const gain = ctx.createGain()
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(140, now)
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.08)
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.exponentialRampToValueAtTime(0.45, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.24)
  setTimeout(() => void ctx.close().catch(() => undefined), 350)
}

// ── Main component ───────────────────────────────────────────────────────────

export function AuctionRoom({ initial, accessToken }: Props) {
  const [auction, setAuction] = useState(initial)
  const [bidFeed, setBidFeed] = useState<BidFeedItem[]>([])
  const [bidAmount, setBidAmount] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState(initial.auctionTeams[0]?.id ?? '')
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [particles, setParticles] = useState<CashParticle[]>([])
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([])
  const [soldBanner, setSoldBanner] = useState<SoldBanner | null>(null)
  const [editingSettings, setEditingSettings] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    name: initial.name,
    format: initial.format,
    maxSquadSize: initial.maxSquadSize,
    maxOverseasPerSquad: initial.maxOverseasPerSquad,
  })
  const feedRef = useRef<HTMLDivElement>(null)
  const currentLotRef = useRef(initial.currentLot)

  const highestBid = bidFeed.findLast(
    (b) => !b.teamName.startsWith('✓') && !b.teamName.startsWith('—'),
  )
  const highestAmount = highestBid ? Number(highestBid.amount) : 0
  const animatedBid = useCountUp(highestAmount)

  // Auto-scroll bid feed
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [bidFeed])

  // Spawn cash particles
  const spawnParticles = useCallback((delta: string) => {
    const count = 6
    const batch: CashParticle[] = Array.from({ length: count }, () => ({
      id: crypto.randomUUID(),
      x: 10 + Math.random() * 80,
      delta,
    }))
    setParticles((p) => [...p, ...batch])
    setTimeout(() => {
      setParticles((p) => p.filter((x) => !batch.some((b) => b.id === x.id)))
    }, 1200)
  }, [])

  // Spawn a confetti burst on SOLD
  const spawnConfetti = useCallback(() => {
    const batch: ConfettiPiece[] = Array.from({ length: 24 }, () => ({
      id: crypto.randomUUID(),
      x: 20 + Math.random() * 60,
      dx: (Math.random() - 0.5) * 220,
      dy: -(60 + Math.random() * 140),
      rot: (Math.random() - 0.5) * 540,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }))
    setConfetti(batch)
    setTimeout(() => setConfetti([]), 950)
  }, [])

  // Socket.IO setup
  useEffect(() => {
    const socket = getAuctionSocket(accessToken)
    socket.emit(AUCTION_EVENTS.JOIN, { auctionId: initial.id })

    socket.on('exception', (err: { message?: string | string[] }) => {
      const message = Array.isArray(err?.message) ? err.message[0] : err?.message
      setError(message ?? 'Bid rejected')
    })

    socket.on(AUCTION_EVENTS.STATUS, ({ status }: { status: AuctionStatus }) => {
      setAuction((a) => ({ ...a, status }))
    })

    socket.on(AUCTION_EVENTS.LOT_STARTED, ({ lot }: LotStartedPayload) => {
      currentLotRef.current = { id: lot.id, lotNumber: lot.lotNumber, status: 'IN_PROGRESS', player: lot.player, bids: [] }
      setAuction((a) => ({
        ...a,
        currentLot: currentLotRef.current,
      }))
      setBidFeed([])
      setBidAmount('')
    })

    socket.on(AUCTION_EVENTS.BID_PLACED, (payload: BidPayload) => {
      setError(null)
      setBidFeed((f) => {
        const prev = f.findLast((b) => !b.teamName.startsWith('✓') && !b.teamName.startsWith('—'))
        const prevAmt = prev ? Number(prev.amount) : 0
        const delta = Number(payload.amount) - prevAmt
        if (delta > 0) spawnParticles(`+₹${(delta / 100000).toFixed(1)}L`)
        return [
          ...f,
          {
            id: `${payload.auctionTeamId}-${Date.now()}`,
            teamName: payload.teamName,
            amount: payload.amount,
            ts: Date.now(),
            auctionTeamId: payload.auctionTeamId,
          },
        ]
      })
    })

    socket.on(AUCTION_EVENTS.LOT_SOLD, (payload: LotSoldPayload) => {
      spawnConfetti()
      playHammerSound()
      setAuction((a) => ({
        ...a,
        currentLot: null,
        auctionLots: (a.auctionLots ?? []).map((lot) =>
          lot.id === payload.lotId
            ? {
                ...lot,
                status: 'SOLD',
                soldToTeamId: payload.auctionTeamId,
                soldPrice: payload.soldPrice,
                soldToTeam: { team: { name: payload.teamName } },
              }
            : lot,
        ),
        auctionTeams: a.auctionTeams.map((t) =>
          t.id === payload.auctionTeamId
            ? {
                ...t,
                remainingPurse: (Number(t.remainingPurse) - Number(payload.soldPrice)).toString(),
                playersAcquired: t.playersAcquired + 1,
                overseasAcquired: t.overseasAcquired + (currentLotRef.current?.player.isOverseas ? 1 : 0),
              }
            : t,
        ),
      }))
      setSoldBanner({
        id: `${payload.lotId}-${Date.now()}`,
        playerName: currentLotRef.current?.player.name ?? 'Player',
        teamName: payload.teamName,
        soldPrice: payload.soldPrice,
      })
      currentLotRef.current = null
      setTimeout(() => setSoldBanner(null), 1800)
      setBidFeed((f) => [
        ...f,
        { id: `sold-${Date.now()}`, teamName: `✓ SOLD to ${payload.teamName}`, amount: payload.soldPrice, ts: Date.now() },
      ])
    })

    socket.on(AUCTION_EVENTS.LOT_UNSOLD, () => {
      const lotId = currentLotRef.current?.id
      currentLotRef.current = null
      setAuction((a) => ({
        ...a,
        currentLot: null,
        auctionLots: (a.auctionLots ?? []).map((lot) =>
          lot.id === lotId ? { ...lot, status: 'UNSOLD' } : lot,
        ),
      }))
      setBidFeed((f) => [
        ...f,
        { id: `unsold-${Date.now()}`, teamName: '— UNSOLD', amount: '-', ts: Date.now() },
      ])
    })

    return () => {
      socket.emit(AUCTION_EVENTS.LEAVE, { auctionId: initial.id })
      socket.off('exception')
      socket.off(AUCTION_EVENTS.STATUS)
      socket.off(AUCTION_EVENTS.LOT_STARTED)
      socket.off(AUCTION_EVENTS.BID_PLACED)
      socket.off(AUCTION_EVENTS.LOT_SOLD)
      socket.off(AUCTION_EVENTS.LOT_UNSOLD)
    }
  }, [initial.id, accessToken, spawnParticles, spawnConfetti])

  const apiAction = useCallback(
    async (path: string, body?: unknown) => {
      setActionLoading(true)
      setError(null)
      try {
        await apiPost(path, accessToken, body)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed')
      } finally {
        setActionLoading(false)
      }
    },
    [accessToken],
  )

  function handleBid(e: React.FormEvent) {
    e.preventDefault()
    if (!auction.currentLot || !selectedTeamId || !bidAmount) return
    const socket = getAuctionSocket(accessToken)
    socket.emit(AUCTION_EVENTS.BID, {
      auctionId: auction.id,
      lotId: auction.currentLot.id,
      auctionTeamId: selectedTeamId,
      amount: Number(bidAmount),
    })
    setBidAmount('')
  }

  async function handleSettingsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSettingsSaving(true)
    setError(null)
    try {
      const updated: AuctionDetail = await apiPatch(`/auctions/${auction.id}`, accessToken, {
        name: settingsForm.name,
        format: settingsForm.format,
        maxSquadSize: Number(settingsForm.maxSquadSize),
        maxOverseasPerSquad: Number(settingsForm.maxOverseasPerSquad),
      })
      setAuction((a) => ({ ...a, ...updated }))
      setSettingsForm({
        name: updated.name,
        format: updated.format,
        maxSquadSize: updated.maxSquadSize,
        maxOverseasPerSquad: updated.maxOverseasPerSquad,
      })
      setEditingSettings(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSettingsSaving(false)
    }
  }

  const currentLot = auction.currentLot

  return (
    <div className="space-y-6">
      {soldBanner && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/35 backdrop-blur-[1px]">
          <div className="relative overflow-hidden rounded-3xl border border-gold/60 bg-card px-10 py-8 text-center shadow-2xl animate-sold-pop">
            <div className="mx-auto mb-3 h-20 w-20 animate-hammer-strike">
              <div className="mx-auto h-8 w-14 -rotate-12 rounded-md bg-gold shadow-lg" />
              <div className="mx-auto -mt-1 h-14 w-3 rotate-45 rounded-full bg-foreground/80" />
            </div>
            <p className="text-5xl font-black uppercase tracking-widest text-gold-foreground dark:text-gold">Sold</p>
            <p className="mt-2 text-lg font-semibold">{soldBanner.playerName}</p>
            <p className="text-sm text-muted-foreground">
              to {soldBanner.teamName} for ₹{Number(soldBanner.soldPrice).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/auctions" className="text-sm text-muted-foreground hover:underline">
            ← Auctions
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{auction.name}</h1>
          <p className="text-sm text-muted-foreground">
            {auction.format.replace('_', ' ')} · Purse ₹{Number(auction.purseSizePerTeam).toLocaleString()} · Squad {auction.maxSquadSize} · Overseas {auction.maxOverseasPerSquad}
          </p>
          <Badge variant={STATUS_VARIANT[auction.status]} dot={auction.status === 'LIVE'} className="mt-1.5">
            {auction.status}
          </Badge>
        </div>

        {/* Conductor controls */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" disabled={settingsSaving} onClick={() => setEditingSettings((v) => !v)}>
            {editingSettings ? 'Close Settings' : 'Edit Settings'}
          </Button>
          {auction.status === 'DRAFT' && (
            <Button size="sm" disabled={actionLoading} onClick={() => apiAction(`/auctions/${auction.id}/start`)}>
              Start Auction
            </Button>
          )}
          {auction.status === 'LIVE' && !currentLot && (
            <Button size="sm" disabled={actionLoading} onClick={() => apiAction(`/auctions/${auction.id}/lots/next`)}>
              Next Player →
            </Button>
          )}
          {auction.status === 'LIVE' && currentLot && (
            <>
              <Button
                size="sm" variant="outline" disabled={actionLoading}
                onClick={() => apiAction(`/auctions/${auction.id}/lots/${currentLot.id}/unsold`)}
              >
                Unsold
              </Button>
              <Button
                size="sm" disabled={actionLoading || !selectedTeamId}
                onClick={() =>
                  apiAction(`/auctions/${auction.id}/lots/${currentLot.id}/sell`, {
                    auctionTeamId: highestBid?.auctionTeamId ?? selectedTeamId,
                  })
                }
              >
                Sell ✓
              </Button>
            </>
          )}
          {auction.status === 'LIVE' && (
            <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => apiAction(`/auctions/${auction.id}/pause`)}>
              Pause
            </Button>
          )}
          {auction.status === 'PAUSED' && (
            <Button size="sm" disabled={actionLoading} onClick={() => apiAction(`/auctions/${auction.id}/resume`)}>
              Resume
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {editingSettings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Auction Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSettingsSubmit} className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="room-auction-name" className="text-xs">Name</Label>
                <Input id="room-auction-name" value={settingsForm.name} onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="room-auction-format" className="text-xs">Format</Label>
                <select
                  id="room-auction-format"
                  value={settingsForm.format}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, format: e.target.value as AuctionDetail['format'] }))}
                  className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Purse</Label>
                <p className="flex h-8 items-center rounded-lg border border-border bg-muted px-2.5 text-sm text-muted-foreground">
                  ₹{Number(auction.purseSizePerTeam).toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="room-max-squad" className="text-xs">Max squad</Label>
                <Input id="room-max-squad" type="number" min={1} max={50} value={settingsForm.maxSquadSize} onChange={(e) => setSettingsForm((f) => ({ ...f, maxSquadSize: Number(e.target.value) }))} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="room-max-overseas" className="text-xs">Max overseas</Label>
                <Input id="room-max-overseas" type="number" min={0} max={50} value={settingsForm.maxOverseasPerSquad} onChange={(e) => setSettingsForm((f) => ({ ...f, maxOverseasPerSquad: Number(e.target.value) }))} required />
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">
                Purse changes are limited to draft auctions so team purse balances stay accurate.
              </p>
              <Button type="submit" size="sm" className="md:col-span-4" disabled={settingsSaving || !settingsForm.name}>
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <AuctionInsights auction={auction} lots={auction.auctionLots ?? []} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Current lot ────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {currentLot ? `Lot #${currentLot.lotNumber} — On the block` : 'Waiting…'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentLot ? (
                <div className="space-y-4">
                  {/* Player identity */}
                  <div className="flex items-center gap-4">
                    {assetUrl(currentLot.player.photoUrl) ?? currentLot.player.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={assetUrl(currentLot.player.photoUrl) ?? currentLot.player.avatarUrl ?? undefined}
                        alt={currentLot.player.name}
                        className="h-20 w-20 rounded-2xl object-cover shadow-md ring-2 ring-border shrink-0"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center shrink-0 text-2xl font-bold text-muted-foreground">
                        {currentLot.player.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-2xl font-bold truncate">{currentLot.player.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ROLE_FULL[currentLot.player.role] ?? currentLot.player.role}
                        {currentLot.player.country ? ` · ${currentLot.player.country}` : ''}
                        {currentLot.player.isOverseas ? ' · 🌍 Overseas' : ''}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        Base price: ₹{Number(currentLot.player.basePrice).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* ── Bid display with cash animation ─────────── */}
                  <div className="relative rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/30 p-4 overflow-hidden">
                    {/* Sold confetti burst */}
                    {confetti.map((c) => (
                      <span
                        key={c.id}
                        className="pointer-events-none absolute top-1/2 h-2 w-2 rounded-sm animate-confetti select-none"
                        style={{
                          left: `${c.x}%`,
                          backgroundColor: c.color,
                          '--dx': `${c.dx}px`,
                          '--dy': `${c.dy}px`,
                          '--rot': `${c.rot}deg`,
                        } as React.CSSProperties}
                      />
                    ))}

                    {/* Flying cash particles */}
                    {particles.map((p) => (
                      <span
                        key={p.id}
                        className="pointer-events-none absolute bottom-4 text-sm font-bold text-gold-foreground dark:text-gold animate-cash-fly select-none"
                        style={{ left: `${p.x}%` }}
                      >
                        {p.delta}
                      </span>
                    ))}

                    {highestBid ? (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                          Current Bid
                        </p>
                        <p className="text-4xl font-black tabular-nums text-gold-foreground dark:text-gold leading-none">
                          ₹{animatedBid.toLocaleString('en-IN')}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">{highestBid.teamName}</p>

                        {/* Cash stack bars */}
                        <div className="mt-3 flex items-end gap-0.5 h-8">
                          {Array.from({ length: 20 }).map((_, i) => {
                            const base = Number(currentLot.player.basePrice)
                            const filled = highestAmount / base
                            const threshold = (i + 1) / 20
                            const active = filled >= threshold
                            return (
                              <div
                                key={i}
                                className={`flex-1 rounded-sm transition-all duration-300 ${
                                  active ? 'bg-gold' : 'bg-muted'
                                }`}
                                style={{ height: active ? `${50 + i * 2.5}%` : '20%' }}
                              />
                            )
                          })}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground text-right">
                          {((highestAmount / Number(currentLot.player.basePrice)) * 100).toFixed(0)}× base price
                        </p>
                      </>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                          Base Price
                        </p>
                        <p className="text-4xl font-black tabular-nums text-muted-foreground leading-none">
                          ₹{Number(currentLot.player.basePrice).toLocaleString('en-IN')}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Waiting for first bid…</p>
                      </div>
                    )}
                  </div>

                  {/* Bid form */}
                  {auction.status === 'LIVE' && (
                    <form onSubmit={handleBid} className="flex gap-2">
                      <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="flex h-8 rounded-lg border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {auction.auctionTeams.map((t: AuctionTeam) => (
                          <option key={t.id} value={t.id}>
                            {t.team.shortName} (₹{Number(t.remainingPurse).toLocaleString()})
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        placeholder="Bid amount"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        min={currentLot.player.basePrice}
                        className="flex-1"
                        required
                      />
                      <Button type="submit" size="sm">
                        Bid
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {auction.status === 'DRAFT'
                    ? 'Start the auction to begin.'
                    : auction.status === 'COMPLETED'
                      ? 'Auction complete.'
                      : 'Click "Next Player" to put the next lot on the block.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bid feed */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bid Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={feedRef} className="h-48 overflow-y-auto space-y-1 text-sm">
                {bidFeed.length === 0 && (
                  <p className="text-muted-foreground text-xs">No bids yet.</p>
                )}
                {bidFeed.map((b) => (
                  <div key={b.id} className="flex justify-between">
                    <span className={b.teamName.startsWith('✓') ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}>
                      {b.teamName}
                    </span>
                    <span className="font-medium tabular-nums">
                      {b.amount !== '-' ? `₹${Number(b.amount).toLocaleString()}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Teams sidebar ──────────────────────────────────────── */}
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Teams</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {auction.auctionTeams.map((t: AuctionTeam) => {
                const isLeading = !!currentLot && highestBid?.teamName === t.team.name
                return (
                  <div
                    key={t.id}
                    className={`space-y-1 rounded-lg p-2 -m-2 transition-colors ${
                      isLeading ? 'bg-gold/10 ring-1 ring-gold/40' : ''
                    }`}
                  >
                    <div className="flex justify-between text-sm font-medium">
                      <span className="flex items-center gap-1.5 truncate">
                        {t.team.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={assetUrl(t.team.logoUrl)}
                            alt=""
                            className="size-4 shrink-0 rounded-full object-cover ring-1 ring-border"
                          />
                        ) : (
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: t.team.primaryColor ?? 'var(--muted-foreground)' }}
                          />
                        )}
                        <span className="truncate">{t.team.name}</span>
                        {isLeading && <span className="text-xs text-gold-foreground dark:text-gold">👑</span>}
                      </span>
                      <span className="tabular-nums shrink-0">₹{Number(t.remainingPurse).toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(
                            0,
                            (Number(t.remainingPurse) / Number(initial.purseSizePerTeam)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.playersAcquired} players · {t.overseasAcquired} overseas
                    </p>
                    {(t.team.ownerName || t.team.coOwnerName) && (
                      <p className="text-xs text-muted-foreground">
                        {[t.team.ownerName, t.team.coOwnerName].filter(Boolean).join(' / ')}
                      </p>
                    )}
                  </div>
                )
              })}
              {auction.auctionTeams.length === 0 && (
                <p className="text-sm text-muted-foreground">No teams yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
