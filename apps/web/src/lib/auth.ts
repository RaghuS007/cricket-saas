// ── Client-side cookie helpers ───────────────────────────────────────────────
// Used in 'use client' components to read / write the auth token cookie.

const COOKIE = 'auth-token'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function getAccessToken(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

export function setAccessToken(token: string) {
  document.cookie = `${COOKIE}=${encodeURIComponent(token)}; max-age=${MAX_AGE}; path=/; SameSite=Lax`
}

export function clearAccessToken() {
  document.cookie = `${COOKIE}=; max-age=0; path=/`
}
