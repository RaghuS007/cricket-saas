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
  // NOTE: this cookie can't be HttpOnly since it's written from client JS —
  // that would require routing auth through Next.js server route handlers
  // (a BFF proxy) instead of calling the NestJS API directly from the browser,
  // which is a bigger architectural change than this pass covers. The `Secure`
  // flag is applied whenever served over HTTPS so it isn't sent in the clear.
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE}=${encodeURIComponent(token)}; max-age=${MAX_AGE}; path=/; SameSite=Lax${secure}`
}

export function clearAccessToken() {
  document.cookie = `${COOKIE}=; max-age=0; path=/`
}
