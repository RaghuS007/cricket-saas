'use client'

import { useState } from 'react'
import { apiPatch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Team } from '@/lib/types'

interface Props {
  team: Team
  accessToken: string
  onSaved: (updated: Team) => void
  onCancel: () => void
}

export function TeamEditForm({ team, accessToken, onSaved, onCancel }: Props) {
  const [name, setName] = useState(team.name)
  const [shortName, setShortName] = useState(team.shortName)
  const [primaryColor, setPrimaryColor] = useState(team.primaryColor ?? '#16a34a')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team')
    } finally {
      setLoading(false)
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
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={loading || !name || !shortName}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
