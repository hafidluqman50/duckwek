'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useConfig, useDisconnect } from 'wagmi'
import { signTypedData as wagmiSignTypedData, switchChain, getAccount } from 'wagmi/actions'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { privateKeyToAccount } from 'viem/accounts'
import type { Hex } from 'viem'
import { tokenStore, ApiError } from '@/http/client'
import { fetchNonce, verifySignature } from '@/http/auth/authApi'
import { fetchMe, prepareWithdraw, submitWithdraw } from '@/http/profile/profileApi'
import { fetchParts, fetchTracks } from '@/http/catalog/catalogApi'
import { createOrder, type OrderBody, type OrderResult } from '@/http/orders/ordersApi'
import { openPasskeyWallet, deviceWallet } from '@/lib/passkey'
import { appChain } from '@/lib/wagmi'
import { sound } from '@/lib/sound'
import { usdc } from '@/lib/config'
import type { Me, Part, Track } from '@/lib/types'

type SignerKind = 'wallet' | 'passkey' | 'device'
interface Signer {
  kind: SignerKind
  label: string
  address: `0x${string}`
  signTypedData: (td: any) => Promise<Hex>
}

export interface Sheet {
  title: string
  rows: { k: string; v: string }[]
  status: 'review' | 'pending' | 'done'
  pendingLabel: string
  doneLabel: string
  tx?: string | null
  walletLabel: string
}

interface SessionState {
  ready: boolean
  address: `0x${string}` | null
  signerKind: SignerKind | null
  signerLabel: string
  me: Me | null
  tracks: Track[]
  parts: Part[]
  sheet: Sheet | null
  toast: string
  connecting: string | null
  say: (t: string, ms?: number) => void
  refresh: () => Promise<Me | null>
  connectWallet: () => void
  connectPasskey: () => Promise<boolean>
  pay: (body: OrderBody) => Promise<OrderResult | { alreadyIn: true; roomCode: string | null } | null>
  withdraw: () => Promise<void>
  confirmSheet: () => void
  cancelSheet: () => void
  signOut: () => void
}

const Ctx = createContext<SessionState | null>(null)
export const useSession = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSession outside provider')
  return c
}

const BIG = ['value', 'nonce', 'deadline', 'amount', 'ref']
const revive = (td: any) => JSON.parse(JSON.stringify(td), (k, v) => (BIG.includes(k) && typeof v === 'string' && /^\d+$/.test(v) ? BigInt(v) : v))
const SIGNER_KEY = 'duckwek.signer'
const PK_SESSION = 'duckwek.pk'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const config = useConfig()
  const account = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const [ready, setReady] = useState(false)
  const [signer, setSigner] = useState<Signer | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [toast, setToast] = useState('')
  const [connecting, setConnecting] = useState<string | null>(null)
  const sheetWait = useRef<{ ok: () => void; no: (e: Error) => void } | null>(null)
  const wantWalletSignIn = useRef(false)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const say = useCallback((t: string, ms = 2000) => {
    setToast(t)
    if (toastT.current) clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(''), ms)
  }, [])

  const localSigner = (key: Hex, kind: 'passkey' | 'device'): Signer => {
    const acc = privateKeyToAccount(key)
    return {
      kind,
      label: kind === 'passkey' ? 'Passkey wallet' : 'Device wallet',
      address: acc.address.toLowerCase() as `0x${string}`,
      signTypedData: (td) => acc.signTypedData(revive(td)),
    }
  }

  const walletSigner = useCallback((addr: `0x${string}`, name: string): Signer => ({
    kind: 'wallet',
    label: name || 'Wallet',
    address: addr.toLowerCase() as `0x${string}`,
    signTypedData: async (td) => {
      if (getAccount(config).chainId !== appChain.id) await switchChain(config, { chainId: appChain.id })
      return wagmiSignTypedData(config, revive(td))
    },
  }), [config])

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return null
    try {
      const m = await fetchMe()
      setMe(m)
      return m
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        tokenStore.set(null)
        setMe(null)
        setSigner(null)
      }
      return null
    }
  }, [])

  // Boot: catalog + restore session
  useEffect(() => {
    sound.load()
    Promise.all([fetchTracks().then(setTracks), fetchParts().then(setParts)]).catch(() => undefined)
    const kind = localStorage.getItem(SIGNER_KEY) as SignerKind | null
    if (kind === 'device') setSigner(localSigner(deviceWallet().key, 'device'))
    if (kind === 'passkey') {
      const k = sessionStorage.getItem(PK_SESSION) as Hex | null
      if (k) setSigner(localSigner(k, 'passkey'))
    }
    refresh().finally(() => setReady(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep a wallet signer in sync with wagmi
  useEffect(() => {
    if (account.status === 'connected' && account.address) {
      const kind = localStorage.getItem(SIGNER_KEY)
      if (kind === 'wallet' || wantWalletSignIn.current) setSigner(walletSigner(account.address, account.connector?.name || 'Wallet'))
    }
  }, [account.status, account.address, account.connector, walletSigner])

  // Promise-based signature sheet
  const askSheet = useCallback((s: Omit<Sheet, 'status'>) => new Promise<void>((ok, no) => {
    sheetWait.current = { ok, no }
    setSheet({ ...s, status: 'review' })
  }), [])
  const confirmSheet = useCallback(() => sheetWait.current?.ok(), [])
  const cancelSheet = useCallback(() => {
    sheetWait.current?.no(new Error('cancelled'))
    sheetWait.current = null
    setSheet(null)
    say('Cancelled')
  }, [say])
  const sheetStatus = (patch: Partial<Sheet>) => setSheet((s) => (s ? { ...s, ...patch } : s))

  const signIn = useCallback(async (s: Signer) => {
    await askSheet({ title: 'Sign in to DuckWek', rows: [{ k: 'Signature', v: 'One signature, valid 24 h' }, { k: 'Spending limit', v: 'Up to 5 USDC · DuckWek only' }, { k: 'Network fee', v: '0 · sponsored' }], pendingLabel: 'Signing you in…', doneLabel: 'Signed in', walletLabel: s.label })
    sheetStatus({ status: 'pending' })
    try {
      const { session } = await fetchNonce(s.address)
      const signature = await s.signTypedData(session)
      const r = await verifySignature(s.address, signature)
      tokenStore.set(r.token)
      localStorage.setItem(SIGNER_KEY, s.kind)
      setSigner(s)
      sound.play('sign')
      sheetStatus({ status: 'done' })
      await new Promise((res) => setTimeout(res, 700))
      setSheet(null)
      const m = await refresh()
      if (r.isNew) say('Welcome! 5 test USDC are yours on your first order', 2600)
      return m
    } catch (e) {
      setSheet(null)
      sound.play('error')
      say((e as Error).message.includes('rejected') ? 'Signature cancelled' : (e as Error).message, 2600)
      throw e
    } finally {
      sheetWait.current = null
    }
  }, [askSheet, refresh, say])

  // After the RainbowKit modal connects, continue with sign-in once
  useEffect(() => {
    if (wantWalletSignIn.current && account.status === 'connected' && account.address) {
      wantWalletSignIn.current = false
      setConnecting(null)
      signIn(walletSigner(account.address, account.connector?.name || 'Wallet')).catch(() => undefined)
    }
  }, [account.status, account.address, account.connector, signIn, walletSigner])

  const connectWallet = useCallback(() => {
    sound.unlock()
    wantWalletSignIn.current = true
    if (account.status === 'connected' && account.address) {
      wantWalletSignIn.current = false
      signIn(walletSigner(account.address, account.connector?.name || 'Wallet')).catch(() => undefined)
    } else openConnectModal?.()
  }, [account.status, account.address, account.connector, openConnectModal, signIn, walletSigner])

  const connectPasskey = useCallback(async () => {
    sound.unlock()
    setConnecting('Passkey')
    try {
      const w = await openPasskeyWallet()
      if (w.kind === 'passkey') sessionStorage.setItem(PK_SESSION, w.key)
      setConnecting(null)
      await signIn(localSigner(w.key, w.kind))
      return true
    } catch (e) {
      setConnecting(null)
      if (!(e as Error).message.includes('cancelled')) say((e as Error).message)
      return false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signIn, say])

  const pay = useCallback(async (body: OrderBody) => {
    if (!signer) {
      say('Connect first')
      return null
    }
    try {
      const r = await createOrder(body)
      if (r.alreadyIn) return { alreadyIn: true as const, roomCode: r.roomCode ?? null }
      sound.play('coin')
      say(`Paid ${usdc(r.amount)} USDC · confirmed on Monad`, 2200)
      refresh()
      return r
    } catch (e) {
      sound.play('error')
      say((e as Error).message, 3000)
      // The session (the one signature) ended or hit its limit: sign in again.
      if (e instanceof ApiError && e.status === 401) {
        tokenStore.set(null)
        setMe(null)
        setSigner(null)
      }
      throw e
    }
  }, [signer, refresh, say])

  const withdraw = useCallback(async () => {
    if (!signer) return
    try {
      const p = await prepareWithdraw()
      await askSheet({ title: 'Withdraw earnings', rows: [{ k: 'Amount', v: `${usdc(p.withdrawal.amount)} USDC` }, { k: 'To', v: 'Your wallet' }, { k: 'Network fee', v: '0 · sponsored' }], pendingLabel: 'Relayer submitting…', doneLabel: 'Withdrawn', walletLabel: signer.label })
      sheetStatus({ status: 'pending' })
      const sig = await signer.signTypedData(p.typedData)
      const r = await submitWithdraw(p.withdrawal, sig)
      sound.play('coin')
      sheetStatus({ status: 'done', tx: r.tx })
      await new Promise((res) => setTimeout(res, 900))
      setSheet(null)
      refresh()
    } catch (e) {
      setSheet(null)
      if ((e as Error).message !== 'cancelled') say((e as Error).message, 2600)
    } finally {
      sheetWait.current = null
    }
  }, [signer, askSheet, refresh, say])

  const signOut = useCallback(() => {
    tokenStore.set(null)
    localStorage.removeItem(SIGNER_KEY)
    sessionStorage.removeItem(PK_SESSION)
    setMe(null)
    setSigner(null)
    if (account.status === 'connected') disconnect()
  }, [account.status, disconnect])

  const value = useMemo<SessionState>(() => ({
    ready,
    address: me ? (me.address as `0x${string}`) : null,
    signerKind: signer?.kind || null,
    signerLabel: signer?.label || '',
    me, tracks, parts, sheet, toast, connecting,
    say, refresh, connectWallet, connectPasskey, pay, withdraw, confirmSheet, cancelSheet, signOut,
  }), [ready, signer, me, tracks, parts, sheet, toast, connecting, say, refresh, connectWallet, connectPasskey, pay, withdraw, confirmSheet, cancelSheet, signOut])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
