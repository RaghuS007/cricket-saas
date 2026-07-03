'use client'

import { useState } from 'react'
import { apiPatch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Player } from '@/lib/types'

const ROLES = [
  { value: 'BAT', label: 'Batsman' },
  { value: 'BOWL', label: 'Bowler' },
  { value: 'ALL_ROUNDER', label: 'All-Rounder' },
  { value: 'WICKET_KEEPER', label: 'Wicket-Keeper' },
]

interface Props {
  player: Player
  accessToken: string
  onSaved: (updated: Player) => void
  onCancel: () => void
}

export function PlayerEditForm({ player, accessToken, onSaved, onCancel }: Props) {
  const [name, setName] = useState(player.name)
  const [role, setRole] = useState(player.role)
  const [country, setCountry] = useState(player.country ?? '')
  const [basePrice, setBasePrice] = useState(player.basePrice)
  const [isOverseas, setIsOverseas] = useState(player.isOverseas)
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const updated: Player = await apiPatch(`/players/${player.id}`, accessToken, {
        name,
        role,
        basePrice: Number(basePrice),
        country: country.trim() || undefined,
        isOverseas,
        avatarUrl: avatarUrl.trim() || undefined,
      })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save player')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
      {error && <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`edit-name-${player.id}`} className="text-xs">Name</Label>
          <Input id={`edit-name-${player.id}`} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`edit-role-${player.id}`} className="text-xs">Role</Label>
          <select
            id={`edit-role-${player.id}`}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`edit-price-${player.id}`} className="text-xs">Base price (₹)</Label>
          <Input
            id={`edit-price-${player.id}`}
            type="number"
            min={0}
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`edit-country-${player.id}`} className="text-xs">Country</Label>
          <Input id={`edit-country-${player.id}`} value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 self-end pb-1 text-xs">
          <input
            type="checkbox"
            checked={isOverseas}
            onChange={(e) => setIsOverseas(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          Overseas player
        </label>
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`edit-avatar-${player.id}`} className="text-xs">Avatar URL</Label>
          <Input id={`edit-avatar-${player.id}`} value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={loading || !name || !basePrice}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
