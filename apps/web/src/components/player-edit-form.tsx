'use client'

import { useRef, useState } from 'react'
import { apiDelete, apiPatch, apiUpload, assetUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Player } from '@/lib/types'

const MAX_PHOTO_BYTES = 3 * 1024 * 1024

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
  // Fired when just the photo finishes uploading, so the parent list can
  // refresh without closing this form the way a full onSaved (Save/Cancel) would.
  onPhotoUpdated?: (updated: Player) => void
  onCancel: () => void
  // Fired once the player is deleted server-side, so the parent can drop it
  // from its lists and close this form.
  onDeleted?: (id: string) => void
}

export function PlayerEditForm({ player, accessToken, onSaved, onPhotoUpdated, onCancel, onDeleted }: Props) {
  const [name, setName] = useState(player.name)
  const [role, setRole] = useState(player.role)
  const [country, setCountry] = useState(player.country ?? '')
  const [basePrice, setBasePrice] = useState(player.basePrice)
  const [isOverseas, setIsOverseas] = useState(player.isOverseas)
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl ?? '')
  const [photoUrl, setPhotoUrl] = useState(player.photoUrl)
  const [loading, setLoading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Photo must be 3MB or smaller')
      e.target.value = ''
      return
    }
    setError(null)
    setPhotoUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const updated: Player = await apiUpload(`/players/${player.id}/photo`, accessToken, formData)
      setPhotoUrl(updated.photoUrl)
      onPhotoUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setPhotoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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
      onSaved({ ...updated, photoUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save player')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${player.name}"? This cannot be undone.`)) return
    setError(null)
    setDeleting(true)
    try {
      await apiDelete(`/players/${player.id}`, accessToken)
      onDeleted?.(player.id)
    } catch (err) {
      // Most likely a 409: the player still appears in one or more auction lots.
      setError(err instanceof Error ? err.message : 'Failed to delete player')
      setDeleting(false)
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
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`edit-photo-${player.id}`} className="text-xs">Photo</Label>
          <div className="flex items-center gap-2">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(photoUrl)}
                alt={`${name} photo`}
                className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="h-8 w-8 shrink-0 rounded-full border border-dashed border-border" />
            )}
            <input
              ref={fileInputRef}
              id={`edit-photo-${player.id}`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoChange}
              disabled={photoUploading}
              className="flex-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary"
            />
            {photoUploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={loading || deleting || !name || !basePrice}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={loading || deleting}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={loading || deleting}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </form>
  )
}
