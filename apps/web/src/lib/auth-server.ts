// ── Server-side token reader ─────────────────────────────────────────────────
// Used in Server Components and Route Handlers.

import { cookies } from 'next/headers'

export async function getServerToken(): Promise<string | null> {
  const store = await cookies()
  return store.get('auth-token')?.value ?? null
}
