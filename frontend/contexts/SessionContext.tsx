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
import { formatUsdc, formatDuration, DEFAULT_SESSION_TERMS, type SessionTerms } from '@/lib/config'
import type { Me, Part, Track } from '@/lib/types'

type SignerKind = 'wallet' | 'passkey' | 'device'
interface Signer {
  kind: SignerKind
  label: string
  address: `0x${string}`
  signTypedData: (typedData: any) => Promise<Hex>
}

export interface Sheet {
  title: string
  rows: { label: string; value: string }[]
  status: 'review' | 'pending' | 'done'
  pendingLabel: string
  doneLabel: string
  tx?: string | null
  walletLabel: string
}

type WalletState = 'none' | 'checking' | 'reconnect' | 'needsSignIn' | 'signedIn'

interface SessionState {
  ready: boolean
  walletState: WalletState
  walletAddress: `0x${string}` | null
  address: `0x${string}` | null
  signerKind: SignerKind | null
  signerLabel: string
  me: Me | null
  tracks: Track[]
  parts: Part[]
  sheet: Sheet | null
  toast: string
  connecting: string | null
  say: (text: string, milliseconds?: number) => void
  refresh: () => Promise<Me | null>
  openWalletModal: () => void
  signInWithWallet: (terms: SessionTerms) => void
  changeLimit: (terms: SessionTerms) => Promise<void>
  limitSheetOpen: boolean
  openLimitSheet: () => void
  closeLimitSheet: () => void
  connectPasskey: () => Promise<boolean>
  pay: (body: OrderBody) => Promise<OrderResult | { alreadyIn: true; roomCode: string | null } | null>
  withdraw: () => Promise<void>
  confirmSheet: () => void
  cancelSheet: () => void
  signOut: () => void
}

const SessionStateContext = createContext<SessionState | null>(null)

export const useSession = () => {
  const session = useContext(SessionStateContext)

  if (!session) throw new Error('useSession outside provider')

  return session
}

const BIG_NUMBER_KEYS = ['value', 'nonce', 'deadline', 'amount', 'ref']
const reviveBigNumbers = (typedData: any) => JSON.parse(JSON.stringify(typedData), (key, value) => (BIG_NUMBER_KEYS.includes(key) && typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : value))
const SIGNER_KEY = 'duckwek.signer'
const PASSKEY_SESSION_KEY = 'duckwek.pk'
const WALLET_SETTLE_TIMEOUT_MILLISECONDS = 8000
const WALLET_DISCONNECT_TIMEOUT_MILLISECONDS = 3000

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const config = useConfig()
  const account = useAccount()
  const { disconnectAsync } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const [ready, setReady] = useState(false)
  const [storedSigner, setSigner] = useState<Signer | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [toast, setToast] = useState('')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [limitSheetOpen, setLimitSheetOpen] = useState(false)
  const [storedSignerKind, setStoredSignerKind] = useState<SignerKind | null>(null)
  const [walletSettleExpired, setWalletSettleExpired] = useState(false)
  const sheetDecision = useRef<{ confirm: () => void; reject: (error: Error) => void } | null>(null)
  const signCancel = useRef<(() => void) | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const say = useCallback((text: string, milliseconds = 2000) => {
    setToast(text)

    if (toastTimer.current) clearTimeout(toastTimer.current)

    toastTimer.current = setTimeout(() => setToast(''), milliseconds)
  }, [])

  const localSigner = (key: Hex, kind: 'passkey' | 'device'): Signer => {
    const localAccount = privateKeyToAccount(key)

    return {
      kind,
      label: kind === 'passkey' ? 'Passkey wallet' : 'Device wallet',
      address: localAccount.address.toLowerCase() as `0x${string}`,
      signTypedData: (typedData) => localAccount.signTypedData(reviveBigNumbers(typedData)),
    }
  }

  const walletSigner = useCallback((walletAddress: `0x${string}`, name: string): Signer => ({
    kind: 'wallet',
    label: name || 'Wallet',
    address: walletAddress.toLowerCase() as `0x${string}`,
    signTypedData: async (typedData) => {
      if (getAccount(config).chainId !== appChain.id) await switchChain(config, { chainId: appChain.id })

      return wagmiSignTypedData(config, reviveBigNumbers(typedData))
    },
  }), [config])

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return null

    try {
      const profile = await fetchMe()

      setMe(profile)

      return profile
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        tokenStore.set(null)
        setMe(null)
        setSigner(null)
      }

      return null
    }
  }, [])

  useEffect(() => {
    sound.load()
    Promise.all([fetchTracks().then(setTracks), fetchParts().then(setParts)]).catch(() => undefined)

    const kind = localStorage.getItem(SIGNER_KEY) as SignerKind | null

    setStoredSignerKind(kind)

    if (kind === 'device') setSigner(localSigner(deviceWallet().key, 'device'))

    if (kind === 'passkey') {
      const passkeyKey = sessionStorage.getItem(PASSKEY_SESSION_KEY) as Hex | null

      if (passkeyKey) setSigner(localSigner(passkeyKey, 'passkey'))
    }

    refresh().finally(() => setReady(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const askSheet = useCallback((content: Omit<Sheet, 'status'>) => new Promise<void>((confirm, reject) => {
    sheetDecision.current = { confirm, reject }
    setSheet({ ...content, status: 'review' })
  }), [])

  const confirmSheet = useCallback(() => sheetDecision.current?.confirm(), [])

  const cancelSheet = useCallback(() => {
    sheetDecision.current?.reject(new Error('cancelled'))
    sheetDecision.current = null
    signCancel.current?.()
    setSheet(null)
    say('Cancelled')
  }, [say])

  const sheetStatus = (patch: Partial<Sheet>) => setSheet((current) => (current ? { ...current, ...patch } : current))

  const signIn = useCallback(async (signingSigner: Signer, reviewFirst = true, terms: SessionTerms = DEFAULT_SESSION_TERMS) => {
    const sheetContent = { title: 'Sign in to DuckWek', rows: [{ label: 'Signature', value: `One signature, valid ${formatDuration(terms.duration)}` }, { label: 'Spending limit', value: `Up to ${formatUsdc(terms.limit)} USDC · DuckWek only` }, { label: 'Network fee', value: '0 · sponsored' }], pendingLabel: 'Signing you in…', doneLabel: 'Signed in', walletLabel: signingSigner.label }

    if (reviewFirst) await askSheet(sheetContent)
    else setSheet({ ...sheetContent, status: 'pending' })

    sheetStatus({ status: 'pending' })

    try {
      const { session } = await fetchNonce(signingSigner.address, terms.limit, terms.duration)
      const cancelled = new Promise<never>((_, reject) => { signCancel.current = () => reject(new Error('cancelled')) })
      const signature = await Promise.race([signingSigner.signTypedData(session), cancelled])
      const verification = await verifySignature(signingSigner.address, signature)

      tokenStore.set(verification.token)
      localStorage.setItem(SIGNER_KEY, signingSigner.kind)
      setStoredSignerKind(signingSigner.kind)
      setSigner(signingSigner)
      sound.play('sign')
      sheetStatus({ status: 'done' })
      await new Promise((resolve) => setTimeout(resolve, 700))
      setSheet(null)

      const profile = await refresh()

      if (verification.isNew) say('Welcome! 5 test USDC are yours on your first order', 2600)

      return profile
    } catch (error) {
      setSheet(null)

      if ((error as Error).message !== 'cancelled') {
        sound.play('error')
        say((error as Error).message.includes('rejected') ? 'Signature cancelled' : (error as Error).message, 2600)
      }

      throw error
    } finally {
      sheetDecision.current = null
      signCancel.current = null
    }
  }, [askSheet, refresh, say])

  const connectedWalletSigner = useMemo(
    () => (account.status === 'connected' && account.address ? walletSigner(account.address, account.connector?.name || 'Wallet') : null),
    [account.status, account.address, account.connector, walletSigner],
  )

  const walletSessionMatches = !!me && !!account.address && me.address.toLowerCase() === account.address.toLowerCase()
  const usesWallet = storedSignerKind === 'wallet' || storedSigner?.kind === 'wallet'
  const signer = usesWallet ? (connectedWalletSigner && (!me || walletSessionMatches) ? connectedWalletSigner : null) : storedSigner

  const openWalletModal = useCallback(() => {
    sound.unlock()
    openConnectModal?.()
  }, [openConnectModal])

  const signInWithWallet = useCallback((terms: SessionTerms) => {
    sound.unlock()

    if (account.status !== 'connected' || !account.address) {
      openConnectModal?.()

      return
    }

    signIn(walletSigner(account.address, account.connector?.name || 'Wallet'), false, terms).catch(() => undefined)
  }, [account.status, account.address, account.connector, openConnectModal, signIn, walletSigner])

  const openLimitSheet = useCallback(() => setLimitSheetOpen(true), [])
  const closeLimitSheet = useCallback(() => setLimitSheetOpen(false), [])

  const changeLimit = useCallback(async (terms: SessionTerms) => {
    if (!signer) {
      say('Connect first')

      return
    }

    setLimitSheetOpen(false)
    await signIn(signer, signer.kind !== 'wallet', terms).catch(() => undefined)
  }, [signer, signIn, say])

  const connectPasskey = useCallback(async () => {
    sound.unlock()
    setConnecting('Passkey')

    try {
      const localWallet = await openPasskeyWallet()

      if (localWallet.kind === 'passkey') sessionStorage.setItem(PASSKEY_SESSION_KEY, localWallet.key)

      setConnecting(null)
      await signIn(localSigner(localWallet.key, localWallet.kind))

      return true
    } catch (error) {
      setConnecting(null)

      if (!(error as Error).message.includes('cancelled')) say((error as Error).message)

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
      const order = await createOrder(body)

      if (order.alreadyIn) return { alreadyIn: true as const, roomCode: order.roomCode ?? null }

      sound.play('coin')
      say(`Paid ${formatUsdc(order.amount)} USDC · confirmed on Monad`, 2200)
      refresh()

      return order
    } catch (error) {
      sound.play('error')

      if ((error as Error).message.startsWith('Session spending limit reached')) {
        say('Spending limit reached', 3000)
        setLimitSheetOpen(true)
      } else {
        say((error as Error).message, 3000)
      }

      if (error instanceof ApiError && error.status === 401) {
        tokenStore.set(null)
        setMe(null)
        setSigner(null)
      }

      throw error
    }
  }, [signer, refresh, say])

  const withdraw = useCallback(async () => {
    if (!signer) return

    try {
      const preparation = await prepareWithdraw()

      await askSheet({ title: 'Withdraw earnings', rows: [{ label: 'Amount', value: `${formatUsdc(preparation.withdrawal.amount)} USDC` }, { label: 'To', value: 'Your wallet' }, { label: 'Network fee', value: '0 · sponsored' }], pendingLabel: 'Relayer submitting…', doneLabel: 'Withdrawn', walletLabel: signer.label })
      sheetStatus({ status: 'pending' })

      const signature = await signer.signTypedData(preparation.typedData)
      const submission = await submitWithdraw(preparation.withdrawal, signature)

      sound.play('coin')
      sheetStatus({ status: 'done', tx: submission.tx })
      await new Promise((resolve) => setTimeout(resolve, 900))
      setSheet(null)
      refresh()
    } catch (error) {
      setSheet(null)

      if ((error as Error).message !== 'cancelled') say((error as Error).message, 2600)
    } finally {
      sheetDecision.current = null
    }
  }, [signer, askSheet, refresh, say])

  const disconnectWallet = useCallback(async () => {
    const stalled = new Promise<void>((resolve) => setTimeout(resolve, WALLET_DISCONNECT_TIMEOUT_MILLISECONDS))

    try {
      await Promise.race([disconnectAsync(), stalled])
    } catch {}

    if (getAccount(config).status === 'connected') config.setState((state) => ({ ...state, connections: new Map(), current: null, status: 'disconnected' }))
  }, [config, disconnectAsync])

  const signOut = useCallback(() => {
    tokenStore.set(null)
    localStorage.removeItem(SIGNER_KEY)
    sessionStorage.removeItem(PASSKEY_SESSION_KEY)
    setStoredSignerKind(null)
    setMe(null)
    setSigner(null)

    if (account.status === 'connected') disconnectWallet()
  }, [account.status, disconnectWallet])

  const walletSettling = account.status === 'connecting' || account.status === 'reconnecting'

  useEffect(() => {
    if (!walletSettling) return

    const timer = setTimeout(() => setWalletSettleExpired(true), WALLET_SETTLE_TIMEOUT_MILLISECONDS)

    return () => {
      clearTimeout(timer)
      setWalletSettleExpired(false)
    }
  }, [walletSettling])

  const walletState = useMemo<WalletState>(() => {
    if (!me) return account.status === 'connected' && account.address && ready ? 'needsSignIn' : 'none'

    if (storedSignerKind !== 'wallet') return 'signedIn'

    if (walletSettling && !walletSettleExpired) return 'checking'

    if (account.status !== 'connected' || !account.address) return 'reconnect'

    return walletSessionMatches ? 'signedIn' : 'needsSignIn'
  }, [me, ready, storedSignerKind, walletSettling, walletSettleExpired, walletSessionMatches, account.status, account.address])

  const visibleMe = walletState === 'signedIn' ? me : null

  const value = useMemo<SessionState>(() => ({
    ready: ready && walletState !== 'checking',
    walletState,
    walletAddress: account.status === 'connected' && account.address ? account.address : null,
    address: visibleMe ? (visibleMe.address as `0x${string}`) : null,
    signerKind: signer?.kind || null,
    signerLabel: signer?.label || '',
    me: visibleMe, tracks, parts, sheet, toast, connecting,
    limitSheetOpen, openLimitSheet, closeLimitSheet,
    say, refresh, openWalletModal, signInWithWallet, changeLimit, connectPasskey, pay, withdraw, confirmSheet, cancelSheet, signOut,
  }), [ready, walletState, account.status, account.address, signer, visibleMe, tracks, parts, sheet, toast, connecting, limitSheetOpen, openLimitSheet, closeLimitSheet, say, refresh, openWalletModal, signInWithWallet, changeLimit, connectPasskey, pay, withdraw, confirmSheet, cancelSheet, signOut])

  return <SessionStateContext.Provider value={value}>{children}</SessionStateContext.Provider>
}
