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
import { formatUsdc } from '@/lib/config'
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

type WalletState = 'none' | 'checking' | 'reconnect' | 'signedIn'

interface SessionState {
  ready: boolean
  walletState: WalletState
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
  connectWallet: () => void
  reconnectWallet: () => void
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
const WANT_SIGN_IN_KEY = 'duckwek.signin'
const WALLET_SETTLE_TIMEOUT_MILLISECONDS = 8000

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
  const [storedSignerKind, setStoredSignerKind] = useState<SignerKind | null>(null)
  const [walletSettleExpired, setWalletSettleExpired] = useState(false)
  const sheetDecision = useRef<{ confirm: () => void; reject: (error: Error) => void } | null>(null)
  const wantWalletSignIn = useRef(false)
  const replacingSession = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rememberWantWalletSignIn = useCallback((wanted: boolean) => {
    wantWalletSignIn.current = wanted

    if (wanted) sessionStorage.setItem(WANT_SIGN_IN_KEY, '1')
    else sessionStorage.removeItem(WANT_SIGN_IN_KEY)
  }, [])

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
    wantWalletSignIn.current = sessionStorage.getItem(WANT_SIGN_IN_KEY) === '1'

    if (kind === 'device') setSigner(localSigner(deviceWallet().key, 'device'))

    if (kind === 'passkey') {
      const passkeyKey = sessionStorage.getItem(PASSKEY_SESSION_KEY) as Hex | null

      if (passkeyKey) setSigner(localSigner(passkeyKey, 'passkey'))
    }

    refresh().finally(() => setReady(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (account.status === 'connected' && account.address) {
      const kind = localStorage.getItem(SIGNER_KEY)

      if (kind === 'wallet' || wantWalletSignIn.current) setSigner(walletSigner(account.address, account.connector?.name || 'Wallet'))
    }
  }, [account.status, account.address, account.connector, walletSigner])

  const askSheet = useCallback((content: Omit<Sheet, 'status'>) => new Promise<void>((confirm, reject) => {
    sheetDecision.current = { confirm, reject }
    setSheet({ ...content, status: 'review' })
  }), [])

  const confirmSheet = useCallback(() => sheetDecision.current?.confirm(), [])

  const cancelSheet = useCallback(() => {
    sheetDecision.current?.reject(new Error('cancelled'))
    sheetDecision.current = null
    setSheet(null)
    say('Cancelled')
  }, [say])

  const sheetStatus = (patch: Partial<Sheet>) => setSheet((current) => (current ? { ...current, ...patch } : current))

  const signIn = useCallback(async (signingSigner: Signer) => {
    await askSheet({ title: 'Sign in to DuckWek', rows: [{ label: 'Signature', value: 'One signature, valid 24 h' }, { label: 'Spending limit', value: 'Up to 5 USDC · DuckWek only' }, { label: 'Network fee', value: '0 · sponsored' }], pendingLabel: 'Signing you in…', doneLabel: 'Signed in', walletLabel: signingSigner.label })
    sheetStatus({ status: 'pending' })

    try {
      const { session } = await fetchNonce(signingSigner.address)
      const signature = await signingSigner.signTypedData(session)
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
      sound.play('error')
      say((error as Error).message.includes('rejected') ? 'Signature cancelled' : (error as Error).message, 2600)

      throw error
    } finally {
      sheetDecision.current = null
    }
  }, [askSheet, refresh, say])

  const hasSessionFor = useCallback((walletAddress: string) => !!me && me.address.toLowerCase() === walletAddress.toLowerCase(), [me])

  const adoptConnectedWallet = useCallback(async (connectedWallet: Signer) => {
    rememberWantWalletSignIn(false)
    setConnecting(null)

    if (hasSessionFor(connectedWallet.address)) {
      setSigner(connectedWallet)

      return
    }

    await signIn(connectedWallet)
  }, [hasSessionFor, rememberWantWalletSignIn, signIn])

  const forgetStoredSession = useCallback(() => {
    tokenStore.set(null)
    localStorage.removeItem(SIGNER_KEY)
    setStoredSignerKind(null)
    setMe(null)
    setSigner(null)
  }, [])

  const replaceSessionWithConnectedWallet = useCallback(async (connectedWallet: Signer) => {
    if (replacingSession.current) return

    replacingSession.current = true

    try {
      await signIn(connectedWallet)
    } catch {
      forgetStoredSession()
    } finally {
      replacingSession.current = false
    }
  }, [signIn, forgetStoredSession])

  useEffect(() => {
    if (!ready || !wantWalletSignIn.current || account.status !== 'connected' || !account.address) return

    adoptConnectedWallet(walletSigner(account.address, account.connector?.name || 'Wallet')).catch(() => undefined)
  }, [ready, account.status, account.address, account.connector, adoptConnectedWallet, walletSigner])

  useEffect(() => {
    if (!ready || storedSignerKind !== 'wallet' || !me || account.status !== 'connected' || !account.address) return

    if (hasSessionFor(account.address)) return

    replaceSessionWithConnectedWallet(walletSigner(account.address, account.connector?.name || 'Wallet')).catch(() => undefined)
  }, [ready, storedSignerKind, me, account.status, account.address, account.connector, hasSessionFor, replaceSessionWithConnectedWallet, walletSigner])

  const connectWallet = useCallback(() => {
    sound.unlock()

    if (account.status === 'connected' && account.address) {
      const connectedWallet = walletSigner(account.address, account.connector?.name || 'Wallet')

      if (hasSessionFor(account.address)) setSigner(connectedWallet)
      else signIn(connectedWallet).catch(() => undefined)

      return
    }

    rememberWantWalletSignIn(true)
    openConnectModal?.()
  }, [account.status, account.address, account.connector, hasSessionFor, openConnectModal, rememberWantWalletSignIn, signIn, walletSigner])

  const reconnectWallet = useCallback(() => {
    sound.unlock()
    rememberWantWalletSignIn(false)
    openConnectModal?.()
  }, [openConnectModal, rememberWantWalletSignIn])

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
      say((error as Error).message, 3000)

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

  const signOut = useCallback(() => {
    tokenStore.set(null)
    localStorage.removeItem(SIGNER_KEY)
    sessionStorage.removeItem(PASSKEY_SESSION_KEY)
    rememberWantWalletSignIn(false)
    setStoredSignerKind(null)
    setMe(null)
    setSigner(null)

    if (account.status === 'connected') disconnect()
  }, [account.status, disconnect, rememberWantWalletSignIn])

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
    if (!me) return 'none'

    if (storedSignerKind !== 'wallet') return 'signedIn'

    if (walletSettling && !walletSettleExpired) return 'checking'

    if (account.status !== 'connected' || !account.address) return 'reconnect'

    return account.address.toLowerCase() === me.address.toLowerCase() ? 'signedIn' : 'checking'
  }, [me, storedSignerKind, walletSettling, walletSettleExpired, account.status, account.address])

  const visibleMe = walletState === 'signedIn' ? me : null

  const value = useMemo<SessionState>(() => ({
    ready: ready && walletState !== 'checking',
    walletState,
    address: visibleMe ? (visibleMe.address as `0x${string}`) : null,
    signerKind: signer?.kind || null,
    signerLabel: signer?.label || '',
    me: visibleMe, tracks, parts, sheet, toast, connecting,
    say, refresh, connectWallet, reconnectWallet, connectPasskey, pay, withdraw, confirmSheet, cancelSheet, signOut,
  }), [ready, walletState, signer, visibleMe, tracks, parts, sheet, toast, connecting, say, refresh, connectWallet, reconnectWallet, connectPasskey, pay, withdraw, confirmSheet, cancelSheet, signOut])

  return <SessionStateContext.Provider value={value}>{children}</SessionStateContext.Provider>
}
