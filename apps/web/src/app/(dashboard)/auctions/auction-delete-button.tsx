'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { apiDelete } from '@/lib/api'

interface Props {
  auctionId: string
  auctionName: string
  accessToken: string
}

export function AuctionDeleteButton({ auctionId, auctionName, accessToken }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm(`Delete auction "${auctionName}"? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      try {
        await apiDelete(`/auctions/${auctionId}`, accessToken)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete auction')
      }
    })
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
      >
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
