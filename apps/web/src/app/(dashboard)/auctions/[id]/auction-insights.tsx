'use client'

import { assetUrl } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuctionDetail, AuctionLot, AuctionTeam } from '@/lib/types'

interface Props {
  auction: AuctionDetail
  lots: AuctionLot[]
}

const ROLE_LABEL: Record<string, string> = {
  BAT: 'BAT',
  BOWL: 'BOWL',
  ALL_ROUNDER: 'AR',
  WICKET_KEEPER: 'WK',
}

function money(value: string | number | null | undefined) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`
}

function teamSpend(team: AuctionTeam, lots: AuctionLot[]) {
  return lots
    .filter((lot) => lot.status === 'SOLD' && lot.soldToTeamId === team.id)
    .reduce((sum, lot) => sum + Number(lot.soldPrice ?? 0), 0)
}

export function AuctionInsights({ auction, lots }: Props) {
  const soldLots = lots.filter((lot) => lot.status === 'SOLD')
  const unsoldLots = lots.filter((lot) => lot.status === 'UNSOLD')
  const pendingLots = lots.filter((lot) => lot.status === 'PENDING' || lot.status === 'IN_PROGRESS')
  const totalSpend = soldLots.reduce((sum, lot) => sum + Number(lot.soldPrice ?? 0), 0)
  const topBuy = soldLots.reduce<AuctionLot | null>(
    (top, lot) => (!top || Number(lot.soldPrice ?? 0) > Number(top.soldPrice ?? 0) ? lot : top),
    null,
  )
  const totalPurse = auction.auctionTeams.length * Number(auction.purseSizePerTeam)
  const remainingPurse = auction.auctionTeams.reduce((sum, team) => sum + Number(team.remainingPurse), 0)

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Broadcast Squads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {auction.auctionTeams.map((team) => {
              const squad = soldLots.filter((lot) => lot.soldToTeamId === team.id)
              const spend = teamSpend(team, lots)
              return (
                <div key={team.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div
                    className="relative min-h-24 p-3 text-white"
                    style={{ background: `linear-gradient(135deg, ${team.team.primaryColor ?? '#0f766e'}, #020617)` }}
                  >
                    <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/35 to-transparent" />
                    <div className="relative flex items-start gap-3">
                      {team.team.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={assetUrl(team.team.logoUrl)} alt="" className="size-14 rounded-xl bg-white/90 object-cover p-1 shadow-lg" />
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-xl bg-white/15 text-lg font-black shadow-lg">
                          {team.team.shortName}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.25em] opacity-80">{team.team.shortName}</p>
                        <p className="truncate text-lg font-black leading-tight">{team.team.name}</p>
                        {(team.team.ownerName || team.team.coOwnerName) && (
                          <p className="mt-1 text-xs opacity-85">
                            {[team.team.ownerName, team.team.coOwnerName].filter(Boolean).join(' / ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center text-xs">
                    <div className="p-2"><p className="font-bold">{squad.length}</p><p className="text-muted-foreground">Players</p></div>
                    <div className="p-2"><p className="font-bold">{team.overseasAcquired}</p><p className="text-muted-foreground">Overseas</p></div>
                    <div className="p-2"><p className="font-bold">{money(spend)}</p><p className="text-muted-foreground">Spent</p></div>
                  </div>

                  <div className="max-h-48 overflow-y-auto p-2">
                    {squad.length === 0 ? (
                      <p className="px-1 py-3 text-center text-xs text-muted-foreground">No players bought yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {squad.map((lot) => (
                          <div key={lot.id} className="flex items-center gap-2 rounded-lg bg-muted/45 px-2 py-1.5">
                            {assetUrl(lot.player.photoUrl) ?? lot.player.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={assetUrl(lot.player.photoUrl) ?? lot.player.avatarUrl ?? undefined} alt="" className="size-7 rounded-full object-cover" />
                            ) : (
                              <div className="flex size-7 items-center justify-center rounded-full bg-background text-[10px] font-bold">
                                {lot.player.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{lot.player.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {ROLE_LABEL[lot.player.role] ?? lot.player.role}{lot.player.isOverseas ? ' · OVS' : ''}
                              </p>
                            </div>
                            <p className="text-xs font-bold tabular-nums">{money(lot.soldPrice)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Auction Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-xs text-muted-foreground">Sold</p><p className="text-2xl font-black">{soldLots.length}</p></div>
            <div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">Available</p><p className="text-2xl font-black">{pendingLots.length}</p></div>
            <div className="rounded-xl bg-gold/15 p-3"><p className="text-xs text-muted-foreground">Total Spend</p><p className="text-lg font-black">{money(totalSpend)}</p></div>
            <div className="rounded-xl bg-destructive/10 p-3"><p className="text-xs text-muted-foreground">Unsold</p><p className="text-2xl font-black">{unsoldLots.length}</p></div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Purse pool</span><span className="font-semibold">{money(totalPurse)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Remaining purse</span><span className="font-semibold">{money(remainingPurse)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Average sale</span><span className="font-semibold">{money(soldLots.length ? totalSpend / soldLots.length : 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Squad fill</span><span className="font-semibold">{soldLots.length}/{auction.auctionTeams.length * auction.maxSquadSize}</span></div>
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top Buy</p>
            {topBuy ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{topBuy.player.name}</p>
                  <p className="text-xs text-muted-foreground">{topBuy.soldToTeam?.team.name ?? 'Team'}</p>
                </div>
                <p className="font-black tabular-nums text-gold-foreground dark:text-gold">{money(topBuy.soldPrice)}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Waiting for first sale.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
