'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiPost, apiDelete } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuctionDetail, AuctionLot, Team, Player } from '@/lib/types'

interface Props {
  initial: AuctionDetail
  initialLots: AuctionLot[]
  allTeams: Team[]
  allPlayers: Player[]
  accessToken: string
}

const ROLE_LABEL: Record<string, string> = {
  BAT: 'BAT',
  BOWL: 'BOWL',
  ALL_ROUNDER: 'AR',
  WICKET_KEEPER: 'WK',
}

export function AuctionSetup({ initial, initialLots, allTeams, allPlayers, accessToken }: Props) {
  const router = useRouter()
  const [auction, setAuction] = useState(initial)
  const [lots, setLots] = useState<AuctionLot[]>(initialLots)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const addedTeamIds = new Set(auction.auctionTeams.map((t) => t.teamId))
  const addedPlayerIds = new Set(lots.map((l) => l.player.id))

  const availableTeams = allTeams.filter((t) => !addedTeamIds.has(t.id))
  const availablePlayers = allPlayers.filter((p) => !addedPlayerIds.has(p.id))

  const canStart = auction.auctionTeams.length >= 2 && lots.length >= 1

  async function withError(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  async function handleAddTeam() {
    if (!selectedTeamId) return
    await withError(async () => {
      const auctionTeam = await apiPost(`/auctions/${auction.id}/teams`, accessToken, { teamId: selectedTeamId })
      setAuction((a) => ({ ...a, auctionTeams: [...a.auctionTeams, auctionTeam] }))
      setSelectedTeamId('')
    })
  }

  async function handleRemoveTeam(auctionTeamId: string) {
    await withError(async () => {
      await apiDelete(`/auctions/${auction.id}/teams/${auctionTeamId}`, accessToken)
      setAuction((a) => ({ ...a, auctionTeams: a.auctionTeams.filter((t) => t.id !== auctionTeamId) }))
    })
  }

  async function handleAddPlayers() {
    if (selectedPlayerIds.size === 0) return
    await withError(async () => {
      const updatedLots: AuctionLot[] = await apiPost(`/auctions/${auction.id}/lots`, accessToken, {
        playerIds: Array.from(selectedPlayerIds),
      })
      setLots(updatedLots)
      setSelectedPlayerIds(new Set())
    })
  }

  async function handleRemoveLot(lotId: string) {
    await withError(async () => {
      await apiDelete(`/auctions/${auction.id}/lots/${lotId}`, accessToken)
      setLots((ls) => ls.filter((l) => l.id !== lotId))
    })
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((s) => {
      const next = new Set(s)
      next.has(playerId) ? next.delete(playerId) : next.add(playerId)
      return next
    })
  }

  function handleStart() {
    startTransition(async () => {
      await withError(async () => {
        await apiPost(`/auctions/${auction.id}/start`, accessToken)
        router.refresh()
      })
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/auctions" className="text-sm text-muted-foreground hover:underline">
            ← Auctions
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{auction.name}</h1>
          <p className="text-sm text-muted-foreground">
            {auction.format.replace('_', ' ')} · Purse ₹{Number(auction.purseSizePerTeam).toLocaleString()} · Squad {auction.maxSquadSize} · Overseas {auction.maxOverseasPerSquad}
          </p>
        </div>
        <Button
          disabled={!canStart || isPending}
          onClick={handleStart}
          title={!canStart ? 'Need at least 2 teams and 1 player' : undefined}
        >
          {isPending ? 'Starting…' : 'Start Auction →'}
        </Button>
      </div>

      {!canStart && (
        <p className="text-sm text-muted-foreground rounded-md bg-muted px-3 py-2">
          Add at least 2 teams and 1 player before starting.
        </p>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Teams ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Teams <span className="font-normal text-muted-foreground">({auction.auctionTeams.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Add team row */}
            <div className="flex gap-2">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="flex h-8 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={availableTeams.length === 0}
              >
                <option value="">
                  {availableTeams.length === 0 ? 'All teams added' : 'Select a team…'}
                </option>
                {availableTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleAddTeam}
                disabled={!selectedTeamId}
              >
                Add
              </Button>
            </div>

            {/* Added teams list */}
            {auction.auctionTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {auction.auctionTeams.map((at) => (
                  <li key={at.id} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">{at.team.name}</span>
                    <button
                      onClick={() => handleRemoveTeam(at.id)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Remove ${at.team.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Players ───────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Players <span className="font-normal text-muted-foreground">({lots.length} in auction)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Player selector */}
            {availablePlayers.length > 0 && (
              <div className="space-y-2">
                <div className="h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {availablePlayers.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlayerIds.has(p.id)}
                        onChange={() => togglePlayer(p.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {p.avatarUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatarUrl} alt={p.name} className="h-7 w-7 rounded-full object-cover shrink-0" />
                      )}
                      <span className="flex-1 text-sm">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{ROLE_LABEL[p.role] ?? p.role}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ₹{Number(p.basePrice).toLocaleString()}
                      </span>
                      {p.isOverseas && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">OVS</span>
                      )}
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleAddPlayers}
                  disabled={selectedPlayerIds.size === 0}
                >
                  Add {selectedPlayerIds.size > 0 ? `${selectedPlayerIds.size} player${selectedPlayerIds.size > 1 ? 's' : ''}` : 'players'} to auction
                </Button>
              </div>
            )}

            {/* Added lots list */}
            {lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players added yet.</p>
            ) : (
              <div className="max-h-52 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                {lots.map((lot) => (
                  <div key={lot.id} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">
                      #{lot.lotNumber}
                    </span>
                    <span className="flex-1 text-sm">{lot.player.name}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_LABEL[lot.player.role] ?? lot.player.role}</span>
                    <button
                      onClick={() => handleRemoveLot(lot.id)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Remove ${lot.player.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
