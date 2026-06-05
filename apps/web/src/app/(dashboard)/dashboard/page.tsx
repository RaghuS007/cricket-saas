import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerToken } from '@/lib/auth-server'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Auction } from '@/lib/types'

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
        <Card>
          <CardHeader><CardTitle className="text-base">Live Auctions</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{live}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Draft Auctions</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{draft}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Completed</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-muted-foreground">{done}</p></CardContent>
        </Card>
      </div>

      {auctions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No auctions yet.{' '}
            <Link href="/auctions/new" className="font-medium text-foreground underline underline-offset-4">
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
                <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/40 transition-colors">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-sm text-muted-foreground">{a.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
