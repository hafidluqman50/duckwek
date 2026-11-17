import { API_URL } from '@/lib/config'

const TOKEN_KEY = 'duckwek.token'

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string | null) => (token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)),
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: unknown) {
    super(message)
  }
}

export async function api<T = any>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = tokenStore.get()

  if (options.auth !== false && token) headers.authorization = `Bearer ${token}`

  const response = await fetch(API_URL + path, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined })
  let json: any = null

  try {
    json = await response.json()
  } catch {}

  if (!response.ok || !json?.status) {
    const validations = json?.data?.validations

    throw new ApiError(validations ? validations.join(', ') : json?.message || `Request failed (${response.status})`, response.status, json?.data)
  }

  return json.data as T
}
