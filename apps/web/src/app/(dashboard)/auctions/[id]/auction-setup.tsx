'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiPost, apiDelete } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlayerEditForm } from '@/components/player-edit-form'
import { TeamEditForm } from '@/components/team-edit-form'
import type { AuctionDetail, AuctionLot, AuctionTeam, Team, Player } from '@/lib/types'

const ROLES = [
  { value: 'BAT', label: 'Batsman' },
  { value: 'BOWL', label: 'Bowler' },
  { value: 'ALL_ROUNDER', label: 'All-Rounder' },
  { value: 'WICKET_KEEPER', label: 'Wicket-Keeper' },
]

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
  const [teams, setTeams] = useState<Team[]>(allTeams)
  const [players, setPlayers] = useState<Player[]>(allPlayers)
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set())
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Which row (if any) is being edited inline
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)

  // Quick-add-team form
  const [showNewTeamForm, setShowNewTeamForm] = useState(false)
  const [newTeamLoading, setNewTeamLoading] = useState(false)
  const [newTeamError, setNewTeamError] = useState<string | null>(null)
  const [newTeamSuccess, setNewTeamSuccess] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamShortName, setNewTeamShortName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState('#16a34a')

  // Quick-add-player form
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false)
  const [newPlayerLoading, setNewPlayerLoading] = useState(false)
  const [newPlayerError, setNewPlayerError] = useState<string | null>(null)
  const [newPlayerSuccess, setNewPlayerSuccess] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('BAT')
  const [newCountry, setNewCountry] = useState('')
  const [newBasePrice, setNewBasePrice] = useState('')
  const [newIsOverseas, setNewIsOverseas] = useState(false)
  const [newAvatarUrl, setNewAvatarUrl] = useState('')

  const addedTeamIds = new Set(auction.auctionTeams.map((t) => t.teamId))
  const addedPlayerIds = new Set(lots.map((l) => l.player.id))

  const availableTeams = teams.filter((t) => !addedTeamIds.has(t.id))
  const availablePlayers = players.filter((p) => !addedPlayerIds.has(p.id))

  const canStart = auction.auctionTeams.length >= 2 && lots.length >= 1

  async function withError(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  async function handleAddTeams() {
    if (selectedTeamIds.size === 0) return
    await withError(async () => {
      // The bulk-add endpoint only exists for lots; teams are added one at a
      // time server-side, so we fire them in sequence and merge the results.
      const added: AuctionTeam[] = []
      for (const teamId of selectedTeamIds) {
        added.push(await apiPost(`/auctions/${auction.id}/teams`, accessToken, { teamId }))
      }
      setAuction((a) => ({ ...a, auctionTeams: [...a.auctionTeams, ...added] }))
      setSelectedTeamIds(new Set())
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

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    setNewTeamError(null)
    setNewTeamSuccess(null)
    setNewTeamLoading(true)
    try {
      const team: Team = await apiPost('/teams', accessToken, {
        name: newTeamName,
        shortName: newTeamShortName.toUpperCase(),
        primaryColor: newTeamColor,
      })
      setTeams((ts) => [...ts, team])
      setSelectedTeamIds((s) => new Set(s).add(team.id)) // pre-checked, ready to add below
      setNewTeamSuccess(`Added "${team.name}" — check it below and click "Add to auction" when ready.`)
      setNewTeamName('')
      setNewTeamShortName('')
      setNewTeamColor('#16a34a')
    } catch (err) {
      setNewTeamError(err instanceof Error ? err.message : 'Failed to add team')
    } finally {
      setNewTeamLoading(false)
    }
  }

  async function handleCreatePlayer(e: React.FormEvent) {
    e.preventDefault()
    setNewPlayerError(null)
    setNewPlayerSuccess(null)
    setNewPlayerLoading(true)
    try {
      const player: Player = await apiPost('/players', accessToken, {
        name: newName,
        role: newRole,
        basePrice: Number(newBasePrice),
        country: newCountry.trim() || undefined,
        isOverseas: newIsOverseas,
        avatarUrl: newAvatarUrl.trim() || undefined,
      })
      setPlayers((ps) => [...ps, player])
      setSelectedPlayerIds((s) => new Set(s).add(player.id)) // pre-checked, ready to add below
      setNewPlayerSuccess(`Added "${player.name}" — check it below and click "Add to auction" when ready.`)
      setNewName('')
      setNewCountry('')
      setNewBasePrice('')
      setNewIsOverseas(false)
      setNewAvatarUrl('')
    } catch (err) {
      setNewPlayerError(err instanceof Error ? err.message : 'Failed to add player')
    } finally {
      setNewPlayerLoading(false)
    }
  }

  function handleTeamSaved(updated: Team) {
    setTeams((ts) => ts.map((t) => (t.id === updated.id ? updated : t)))
    setAuction((a) => ({
      ...a,
      auctionTeams: a.auctionTeams.map((at) =>
        at.teamId === updated.id ? { ...at, team: { ...at.team, ...updated } } : at,
      ),
    }))
    setEditingTeamId(null)
  }

  function handlePlayerSaved(updated: Player) {
    setPlayers((ps) => ps.map((p) => (p.id === updated.id ? updated : p)))
    setLots((ls) => ls.map((l) => (l.player.id === updated.id ? { ...l, player: updated } : l)))
    setEditingPlayerId(null)
  }

  function toggleTeam(teamId: string) {
    setSelectedTeamIds((s) => {
      const next = new Set(s)
      next.has(teamId) ? next.delete(teamId) : next.add(teamId)
      return next
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
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                Teams <span className="font-normal text-muted-foreground">({auction.auctionTeams.length})</span>
              </CardTitle>
              <Button size="xs" variant="outline" onClick={() => setShowNewTeamForm((v) => !v)}>
                {showNewTeamForm ? 'Close' : '+ New Team'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Quick-add-team form */}
            {showNewTeamForm && (
              <form
                onSubmit={handleCreateTeam}
                className="space-y-2.5 rounded-lg border border-dashed border-border bg-muted/30 p-3"
              >
                {newTeamError && (
                  <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{newTeamError}</p>
                )}
                {newTeamSuccess && (
                  <p className="rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">{newTeamSuccess}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="new-team-name" className="text-xs">Name</Label>
                    <Input
                      id="new-team-name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Mumbai Marauders"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-team-short" className="text-xs">Short name</Label>
                    <Input
                      id="new-team-short"
                      value={newTeamShortName}
                      onChange={(e) => setNewTeamShortName(e.target.value.toUpperCase())}
                      placeholder="MUM"
                      maxLength={10}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-team-color" className="text-xs">Color</Label>
                    <div className="flex h-8 items-center gap-2">
                      <input
                        id="new-team-color"
                        type="color"
                        value={newTeamColor}
                        onChange={(e) => setNewTeamColor(e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded-md border border-border bg-background p-0.5"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">{newTeamColor}</span>
                    </div>
                  </div>
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={newTeamLoading || !newTeamName || !newTeamShortName}>
                  {newTeamLoading ? 'Adding…' : 'Add Team'}
                </Button>
              </form>
            )}

            {/* Available teams */}
            {availableTeams.length > 0 && (
              <div className="space-y-2">
                <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {availableTeams.map((t) =>
                    editingTeamId === t.id ? (
                      <div key={t.id} className="p-1.5">
                        <TeamEditForm team={t} accessToken={accessToken} onSaved={handleTeamSaved} onCancel={() => setEditingTeamId(null)} />
                      </div>
                    ) : (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/40 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamIds.has(t.id)}
                          onChange={() => toggleTeam(t.id)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: t.primaryColor ?? 'var(--muted-foreground)' }}
                        />
                        <span className="flex-1 text-sm">{t.name}</span>
                        <span className="text-xs text-muted-foreground">{t.shortName}</span>
                        {t.organizationId != null && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setEditingTeamId(t.id) }}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                            aria-label={`Edit ${t.name}`}
                          >
                            ✎
                          </button>
                        )}
                      </label>
                    ),
                  )}
                </div>
                <Button size="sm" className="w-full" onClick={handleAddTeams} disabled={selectedTeamIds.size === 0}>
                  Add {selectedTeamIds.size > 0 ? `${selectedTeamIds.size} team${selectedTeamIds.size > 1 ? 's' : ''}` : 'teams'} to auction
                </Button>
              </div>
            )}

            {/* Added teams list */}
            {auction.auctionTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {auction.auctionTeams.map((at) => {
                  const fullTeam = teams.find((t) => t.id === at.teamId)
                  return editingTeamId === at.teamId && fullTeam ? (
                    <li key={at.id} className="py-1.5">
                      <TeamEditForm team={fullTeam} accessToken={accessToken} onSaved={handleTeamSaved} onCancel={() => setEditingTeamId(null)} />
                    </li>
                  ) : (
                    <li key={at.id} className="flex items-center gap-2 py-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: at.team.primaryColor ?? 'var(--muted-foreground)' }}
                      />
                      <span className="flex-1 text-sm font-medium">{at.team.name}</span>
                      {fullTeam?.organizationId != null && (
                        <button
                          onClick={() => setEditingTeamId(at.teamId)}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                          aria-label={`Edit ${at.team.name}`}
                        >
                          ✎
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveTeam(at.id)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remove ${at.team.name}`}
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Players ───────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                Players <span className="font-normal text-muted-foreground">({lots.length} in auction)</span>
              </CardTitle>
              <Button size="xs" variant="outline" onClick={() => setShowNewPlayerForm((v) => !v)}>
                {showNewPlayerForm ? 'Close' : '+ New Player'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Quick-add-player form */}
            {showNewPlayerForm && (
              <form
                onSubmit={handleCreatePlayer}
                className="space-y-2.5 rounded-lg border border-dashed border-border bg-muted/30 p-3"
              >
                {newPlayerError && (
                  <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{newPlayerError}</p>
                )}
                {newPlayerSuccess && (
                  <p className="rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">{newPlayerSuccess}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="new-player-name" className="text-xs">Name</Label>
                    <Input
                      id="new-player-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Player name"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-player-role" className="text-xs">Role</Label>
                    <select
                      id="new-player-role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-player-price" className="text-xs">Base price (₹)</Label>
                    <Input
                      id="new-player-price"
                      type="number"
                      min={0}
                      value={newBasePrice}
                      onChange={(e) => setNewBasePrice(e.target.value)}
                      placeholder="1000000"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-player-country" className="text-xs">Country (optional)</Label>
                    <Input
                      id="new-player-country"
                      value={newCountry}
                      onChange={(e) => setNewCountry(e.target.value)}
                      placeholder="India"
                    />
                  </div>
                  <label className="flex items-center gap-2 self-end pb-1 text-xs">
                    <input
                      type="checkbox"
                      checked={newIsOverseas}
                      onChange={(e) => setNewIsOverseas(e.target.checked)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    Overseas player
                  </label>
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="new-player-avatar" className="text-xs">Avatar URL (optional)</Label>
                    <Input
                      id="new-player-avatar"
                      value={newAvatarUrl}
                      onChange={(e) => setNewAvatarUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={newPlayerLoading || !newName || !newBasePrice}>
                  {newPlayerLoading ? 'Adding…' : 'Add Player'}
                </Button>
              </form>
            )}

            {/* Player selector */}
            {availablePlayers.length > 0 && (
              <div className="space-y-2">
                <div className="h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {availablePlayers.map((p) =>
                    editingPlayerId === p.id ? (
                      <div key={p.id} className="p-1.5">
                        <PlayerEditForm player={p} accessToken={accessToken} onSaved={handlePlayerSaved} onCancel={() => setEditingPlayerId(null)} />
                      </div>
                    ) : (
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
                        {p.organizationId != null && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setEditingPlayerId(p.id) }}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                            aria-label={`Edit ${p.name}`}
                          >
                            ✎
                          </button>
                        )}
                      </label>
                    ),
                  )}
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
                {lots.map((lot) =>
                  editingPlayerId === lot.player.id ? (
                    <div key={lot.id} className="p-1.5">
                      <PlayerEditForm player={lot.player} accessToken={accessToken} onSaved={handlePlayerSaved} onCancel={() => setEditingPlayerId(null)} />
                    </div>
                  ) : (
                    <div key={lot.id} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">
                        #{lot.lotNumber}
                      </span>
                      <span className="flex-1 text-sm">{lot.player.name}</span>
                      <span className="text-xs text-muted-foreground">{ROLE_LABEL[lot.player.role] ?? lot.player.role}</span>
                      {lot.player.organizationId != null && (
                        <button
                          onClick={() => setEditingPlayerId(lot.player.id)}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                          aria-label={`Edit ${lot.player.name}`}
                        >
                          ✎
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveLot(lot.id)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remove ${lot.player.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
