import { redirect } from 'next/navigation'
import { getServerToken } from '@/lib/auth-server'
import { apiGet } from '@/lib/api'
import { AuctionRoom } from './auction-room'
import { AuctionSetup } from './auction-setup'
import type { AuctionDetail, AuctionLot, Team, Player } from '@/lib/types'

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getServerToken()
  if (!token) redirect('/login')

  const auction: AuctionDetail = await apiGet(`/auctions/${id}`, token)

  if (auction.status === 'DRAFT') {
    const [lots, allTeams, allPlayers] = await Promise.all([
      apiGet(`/auctions/${id}/lots`, token) as Promise<AuctionLot[]>,
      apiGet('/teams', token) as Promise<Team[]>,
      apiGet('/players', token) as Promise<Player[]>,
    ])

    return (
      <AuctionSetup
        initial={auction}
        initialLots={lots}
        allTeams={allTeams}
        allPlayers={allPlayers}
        accessToken={token}
      />
    )
  }

  return <AuctionRoom initial={auction} accessToken={token} />
}
