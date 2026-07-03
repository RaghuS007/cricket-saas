export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

// Backend stores asset paths (e.g. team logos) as host-relative URLs like
// "/uploads/team-logos/xxx.png" — prefix with the API origin to render them
// from the web app, which runs on a different port.
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  return path.startsWith('http') ? path : `${API_URL}${path}`
}

async function errorMessage(res: Response, path: string): Promise<string> {
  const text = await res.text().catch(() => '')
  if (text) {
    try {
      const body = JSON.parse(text) as { message?: string | string[] }
      if (body.message) return Array.isArray(body.message) ? body.message[0] : body.message
    } catch {
      // not JSON — fall through to the raw text
    }
  }
  return text || `API ${path} → ${res.status}`
}

export async function apiDelete(path: string, token: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await errorMessage(res, path))
  return res.json()
}

export async function apiGet(path: string, token: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await errorMessage(res, path))
  return res.json()
}

export async function apiPost(path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await errorMessage(res, path))
  return res.json()
}

export async function apiPatch(path: string, token: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await errorMessage(res, path))
  return res.json()
}

export async function apiUpload(path: string, token: string, formData: FormData) {
  // No Content-Type header here — the browser sets multipart/form-data with
  // the correct boundary automatically when the body is a FormData instance.
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) throw new Error(await errorMessage(res, path))
  return res.json()
}
