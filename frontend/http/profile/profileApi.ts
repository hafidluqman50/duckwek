import { api } from '@/http/client'
import type { Duck, Me } from '@/lib/types'

export const fetchMe = () => api<Me>('/api/me')
export const saveDuck = (d: Pick<Duck, 'name' | 'template' | 'bodyColor' | 'billColor' | 'cosmetics' | 'equippedPartTypeId'>) => api<Duck>('/api/me/duck', { method: 'PUT', body: d })
export const prepareWithdraw = () => api<{ withdrawal: any; typedData: any }>('/api/withdraw/prepare', { method: 'POST', body: {} })
export const submitWithdraw = (withdrawal: unknown, signature: string) => api<{ tx: string; url: string | null }>('/api/withdraw/submit', { method: 'POST', body: { withdrawal, signature } })
