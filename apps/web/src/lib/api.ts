const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

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
