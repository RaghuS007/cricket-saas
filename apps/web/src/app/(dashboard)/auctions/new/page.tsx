'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const FORMATS = [
  { value: 'T20', label: 'T20' },
  { value: 'T10', label: 'T10' },
  { value: 'TENNIS_BALL', label: 'Tennis Ball' },
]

export default function NewAuctionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    format: 'T20',
    purseSizePerTeam: 1000000,
    maxSquadSize: 15,
    maxOverseasPerSquad: 4,
  })

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const auction = await apiPost('/auctions', session.access_token, {
        ...form,
        purseSizePerTeam: Number(form.purseSizePerTeam),
        maxSquadSize: Number(form.maxSquadSize),
        maxOverseasPerSquad: Number(form.maxOverseasPerSquad),
      })
      router.push(`/auctions/${auction.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create auction')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Auction</h1>
        <p className="text-muted-foreground">Set up an IPL-style live auction</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auction Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Auction name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="IPL 2025 Mega Auction"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="format">Format</Label>
              <select
                id="format"
                value={form.format}
                onChange={(e) => set('format', e.target.value)}
                className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purse">Purse per team (₹)</Label>
              <Input
                id="purse"
                type="number"
                min={0}
                value={form.purseSizePerTeam}
                onChange={(e) => set('purseSizePerTeam', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="maxSquad">Max squad size</Label>
                <Input
                  id="maxSquad"
                  type="number"
                  min={1}
                  value={form.maxSquadSize}
                  onChange={(e) => set('maxSquadSize', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxOverseas">Max overseas</Label>
                <Input
                  id="maxOverseas"
                  type="number"
                  min={0}
                  value={form.maxOverseasPerSquad}
                  onChange={(e) => set('maxOverseasPerSquad', e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating…' : 'Create auction'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
