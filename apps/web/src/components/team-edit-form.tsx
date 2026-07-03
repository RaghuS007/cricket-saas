'use client'

import { useRef, useState } from 'react'
import { apiDelete, apiPatch, apiUpload, assetUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Team } from '@/lib/types'

const MAX_LOGO_BYTES = 3 * 1024 * 1024

interface Props {
  team: Team
  accessToken: string
  onSaved: (updated: Team) => void
  // Fired when just the logo finishes uploading, so the parent list can refresh
  // without closing this form the way a full onSaved (form Save/Cancel) would.
  onLogoUpdated?: (updated: Team) => void
  onCancel: () => void
  // Fired once the team is deleted server-side, so the parent can drop it
  // from its lists and close this form.
  onDeleted?: (id: string) => void
}

export function TeamEditForm({ team, accessToken, onSaved, onLogoUpdated, onCancel, onDeleted }: Props) {
  const [name, setName] = useState(team.name)
  const [shortName, setShortName] = useState(team.shortName)
  const [primaryColor, setPrimaryColor] = useState(team.primaryColor ?? '#16a34a')
  const [logoUrl, setLogoUrl] = useState(team.logoUrl)
  const [loading, setLoading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo must be 3MB or smaller')
      e.target.value = ''
      return
    }
    setError(null)
    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const updated: Team = await apiUpload(`/teams/${team.id}/logo`, accessToken, formData)
      setLogoUrl(updated.logoUrl)
      onLogoUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo')
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const updated: Team = await apiPatch(`/teams/${team.id}`, accessToken, {
        name,
        shortName,
        primaryColor,
      })
      onSaved({ ...updated, logoUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${team.name}"? This cannot be undone.`)) return
    setError(null)
    setDeleting(true)
    try {
      await apiDelete(`/teams/${team.id}`, accessToken)
      onDeleted?.(team.id)
    } catch (err) {
      // Most likely a 409: the team is still used in one or more auctions.
      setError(err instanceof Error ? err.message : 'Failed to delete team')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
      {error && <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`edit-team-name-${team.id}`} className="text-xs">Name</Label>
          <Input id={`edit-team-name-${team.id}`} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`edit-team-short-${team.id}`} className="text-xs">Short name</Label>
          <Input
            id={`edit-team-short-${team.id}`}
            value={shortName}
            onChange={(e) => setShortName(e.target.value.toUpperCase())}
            maxLength={10}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`edit-team-color-${team.id}`} className="text-xs">Color</Label>
          <div className="flex h-8 items-center gap-2">
            <input
              id={`edit-team-color-${team.id}`}
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-md border border-border bg-background p-0.5"
            />
            <span className="text-xs text-muted-foreground tabular-nums">{primaryColor}</span>
          </div>
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`edit-team-logo-${team.id}`} className="text-xs">Logo</Label>
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(logoUrl)}
                alt={`${name} logo`}
                className="h-8 w-8 shrink-0 rounded-md border border-border object-cover"
              />
            ) : (
              <div className="h-8 w-8 shrink-0 rounded-md border border-dashed border-border" />
            )}
            <input
              ref={fileInputRef}
              id={`edit-team-logo-${team.id}`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoChange}
              disabled={logoUploading}
              className="flex-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary"
            />
            {logoUploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={loading || deleting || !name || !shortName}>
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
