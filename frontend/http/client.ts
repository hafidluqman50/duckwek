import { API_URL } from '@/lib/config'

const TOKEN_KEY = 'duckwek.token'

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)),
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: unknown) {
    super(message)
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = tokenStore.get()
  if (opts.auth !== false && token) headers.authorization = `Bearer ${token}`
  const res = await fetch(API_URL + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
  let json: any = null
  try {
    json = await res.json()
  } catch {}
  if (!res.ok || !json?.status) {
    const v = json?.data?.validations
    throw new ApiError(v ? v.join(', ') : json?.message || `Request failed (${res.status})`, res.status, json?.data)
  }
  return json.data as T
}
