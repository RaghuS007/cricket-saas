import { createClient } from '@/lib/supabase/server'
import { apiGet } from '@/lib/api'
import { AuctionRoom } from './auction-room'
import type { AuctionDetail } from '@/lib/types'

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const auction: AuctionDetail = await apiGet(`/auctions/${id}`, session!.access_token)

  return <AuctionRoom initial={auction} accessToken={session!.access_token} />
}
