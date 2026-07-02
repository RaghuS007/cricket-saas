import Link from 'next/link'
import { redirect } from 'next/navigation'
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

export default async function DashboardPage() {
  const token = await getServerToken()
  if (!token) redirect('/login')

  const org = await apiGet('/organizations/me', token).catch(() => null)
  if (!org) redirect('/onboarding')

  const auctions: Auction[] = await apiGet('/auctions', token).catch(() => [])
  const live  = auctions.filter((a) => a.status === 'LIVE').length
  const draft = auctions.filter((a) => a.status === 'DRAFT').length
  const done  = auctions.filter((a) => a.status === 'COMPLETED').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">{org.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <CardHeader><CardTitle className="text-base">Live Auctions</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{live}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gold" />
          <CardHeader><CardTitle className="text-base">Draft Auctions</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{draft}</p></CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-muted-foreground/30" />
          <CardHeader><CardTitle className="text-base">Completed</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-muted-foreground">{done}</p></CardContent>
        </Card>
      </div>

      {auctions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              🏏
            </span>
            <p className="text-muted-foreground">No auctions yet — create your first one to get started.</p>
            <Link
              href="/auctions/new"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Create your first auction →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent auctions</h2>
          <div className="space-y-2">
            {auctions.slice(0, 5).map((a) => (
              <Link key={a.id} href={`/auctions/${a.id}`}>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5">
                  <span className="font-medium">{a.name}</span>
                  <Badge variant={STATUS_VARIANT[a.status]} dot={a.status === 'LIVE'}>{a.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
