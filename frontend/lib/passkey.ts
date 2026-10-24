'use client'

import { keccak256, toHex, type Hex } from 'viem'
import { generatePrivateKey } from 'viem/accounts'

/**
 * "Use Face ID / fingerprint": a wallet whose private key is derived from a passkey with the
 * WebAuthn PRF extension (Chrome 116+, Safari 18+, Android). Same passkey on the same site = same
 * wallet, nothing stored in the browser. Browsers without PRF fall back to a device wallet kept in
 * this browser's storage, and the UI says so.
 */
const CRED_KEY = 'duckwek.passkey.id'
const DEVICE_KEY = 'duckwek.device.key'
const SALT = new TextEncoder().encode('duckwek-wallet-v1')

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export type LocalWalletKind = 'passkey' | 'device'
export interface LocalWallet {
  kind: LocalWalletKind
  key: Hex
}

const prfOut = (cred: PublicKeyCredential | null): ArrayBuffer | null => {
  const ext = cred?.getClientExtensionResults?.() as any
  return ext?.prf?.results?.first ?? null
}

async function assertPrf(credentialId?: string): Promise<{ id: string; out: ArrayBuffer | null }> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: rnd(32),
      userVerification: 'required',
      allowCredentials: credentialId ? [{ id: unb64(credentialId), type: 'public-key' }] : [],
      extensions: { prf: { eval: { first: SALT } } } as any,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('Passkey cancelled')
  return { id: b64(cred.rawId), out: prfOut(cred) }
}

export const passkeySupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials

export async function openPasskeyWallet(): Promise<LocalWallet> {
  if (!passkeySupported()) return deviceWallet()
  const known = localStorage.getItem(CRED_KEY) || undefined
  try {
    if (known) {
      const { out } = await assertPrf(known)
      if (out) return { kind: 'passkey', key: keccak256(toHex(new Uint8Array(out))) }
    }
    const created = (await navigator.credentials.create({
      publicKey: {
        rp: { name: 'DuckWek' },
        user: { id: rnd(16), name: 'duck-' + Date.now().toString(36), displayName: 'DuckWek duck' },
        challenge: rnd(32),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        extensions: { prf: { eval: { first: SALT } } } as any,
      },
    })) as PublicKeyCredential | null
    if (!created) throw new Error('Passkey cancelled')
    const id = b64(created.rawId)
    localStorage.setItem(CRED_KEY, id)
    let out = prfOut(created)
    if (!out) out = (await assertPrf(id)).out
    if (out) return { kind: 'passkey', key: keccak256(toHex(new Uint8Array(out))) }
  } catch (e) {
    if ((e as Error).name === 'NotAllowedError') throw new Error('Passkey cancelled')
    console.warn('[passkey] PRF unavailable, using device wallet', e)
  }
  return deviceWallet()
}

export function deviceWallet(): LocalWallet {
  let key = localStorage.getItem(DEVICE_KEY) as Hex | null
  if (!key) {
    key = generatePrivateKey()
    localStorage.setItem(DEVICE_KEY, key)
  }
  return { kind: 'device', key }
}
