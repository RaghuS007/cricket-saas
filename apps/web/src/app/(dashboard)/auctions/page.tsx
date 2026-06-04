import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Auction } from '@/lib/types'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-secondary text-secondary-foreground',
  LIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  PAUSED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  COMPLETED: 'bg-muted text-muted-foreground',
}

export default async function AuctionsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const auctions: Auction[] = session
    ? await apiGet('/auctions', session.access_token).catch(() => [])
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auctions</h1>
          <p className="text-muted-foreground">Manage your live auctions</p>
        </div>
        <Link
          href="/auctions/new"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          New Auction
        </Link>
      </div>

      {auctions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No auctions yet.{' '}
            <Link href="/auctions/new" className="underline underline-offset-4">
              Create your first auction →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((a) => (
            <Link key={a.id} href={`/auctions/${a.id}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status] ?? ''}`}
                    >
                      {a.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>{a.format.replace('_', ' ')}</p>
                  <p>Purse: ₹{Number(a.purseSizePerTeam).toLocaleString()}</p>
                  <p>
                    {a._count?.auctionTeams ?? 0} teams · {a._count?.auctionLots ?? 0} players
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
