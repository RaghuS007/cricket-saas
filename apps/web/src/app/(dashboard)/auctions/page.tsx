import Link from 'next/link'
import { getServerToken } from '@/lib/auth-server'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Auction, AuctionStatus } from '@/lib/types'

const STATUS_VARIANT: Record<AuctionStatus, 'live' | 'neutral' | 'warning' | 'muted'> = {
  DRAFT: 'neutral',
  LIVE: 'live',
  PAUSED: 'warning',
  COMPLETED: 'muted',
}

export default async function AuctionsPage() {
  const token = await getServerToken()
  const auctions: Auction[] = token ? await apiGet('/auctions', token).catch(() => []) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auctions</h1>
          <p className="text-muted-foreground">Manage your live auctions</p>
        </div>
        <Link
          href="/auctions/new"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          New Auction
        </Link>
      </div>

      {auctions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              🏆
            </span>
            <p className="text-muted-foreground">No auctions yet.</p>
            <Link
              href="/auctions/new"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Create your first auction →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((a) => (
            <Link key={a.id} href={`/auctions/${a.id}`}>
              <Card className="h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <Badge variant={STATUS_VARIANT[a.status]} dot={a.status === 'LIVE'}>{a.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>{a.format.replace('_', ' ')}</p>
                  <p>Purse: ₹{Number(a.purseSizePerTeam).toLocaleString()}</p>
                  <p>{a._count?.auctionTeams ?? 0} teams · {a._count?.auctionLots ?? 0} players</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
