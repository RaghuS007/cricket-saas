import { redirect } from 'next/navigation'
import { getServerToken } from '@/lib/auth-server'
import { apiGet } from '@/lib/api'
import { AuctionRoom } from './auction-room'
import type { AuctionDetail } from '@/lib/types'

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getServerToken()
  if (!token) redirect('/login')

  const auction: AuctionDetail = await apiGet(`/auctions/${id}`, token)

  return <AuctionRoom initial={auction} accessToken={token} />
}
