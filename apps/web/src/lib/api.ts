const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export async function apiGet(path: string, accessToken: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Opt out of Next.js cache so auction state is always fresh
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

export async function apiPost(path: string, accessToken: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

/** Sync the Supabase user to our UserProfile table. Safe to call on every login. */
export async function syncProfile(accessToken: string) {
  try {
    await apiPost('/auth/sync-profile', accessToken)
  } catch {
    // Non-critical: profile will be retried on the next request.
  }
}
