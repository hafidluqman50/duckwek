'use client'

import { keccak256, toHex, type Hex } from 'viem'
import { generatePrivateKey } from 'viem/accounts'

const CREDENTIAL_KEY = 'duckwek.passkey.id'
const DEVICE_KEY = 'duckwek.device.key'
const SALT = new TextEncoder().encode('duckwek-wallet-v1')

const encodeBase64Url = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const decodeBase64Url = (encoded: string) => Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0))
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length))

export type LocalWalletKind = 'passkey' | 'device'
export interface LocalWallet {
  kind: LocalWalletKind
  key: Hex
}

const prfOutput = (credential: PublicKeyCredential | null): ArrayBuffer | null => {
  const extensionResults = credential?.getClientExtensionResults?.() as any

  return extensionResults?.prf?.results?.first ?? null
}

async function assertPrf(credentialId?: string): Promise<{ id: string; output: ArrayBuffer | null }> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      userVerification: 'required',
      allowCredentials: credentialId ? [{ id: decodeBase64Url(credentialId), type: 'public-key' }] : [],
      extensions: { prf: { eval: { first: SALT } } } as any,
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('Passkey cancelled')

  return { id: encodeBase64Url(credential.rawId), output: prfOutput(credential) }
}

export const passkeySupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials

export async function openPasskeyWallet(): Promise<LocalWallet> {
  if (!passkeySupported()) return deviceWallet()

  const knownCredentialId = localStorage.getItem(CREDENTIAL_KEY) || undefined

  try {
    if (knownCredentialId) {
      const { output } = await assertPrf(knownCredentialId)

      if (output) return { kind: 'passkey', key: keccak256(toHex(new Uint8Array(output))) }
    }

    const created = (await navigator.credentials.create({
      publicKey: {
        rp: { name: 'DuckWek' },
        user: { id: randomBytes(16), name: 'duck-' + Date.now().toString(36), displayName: 'DuckWek duck' },
        challenge: randomBytes(32),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        extensions: { prf: { eval: { first: SALT } } } as any,
      },
    })) as PublicKeyCredential | null

    if (!created) throw new Error('Passkey cancelled')

    const credentialId = encodeBase64Url(created.rawId)

    localStorage.setItem(CREDENTIAL_KEY, credentialId)

    let output = prfOutput(created)

    if (!output) output = (await assertPrf(credentialId)).output

    if (output) return { kind: 'passkey', key: keccak256(toHex(new Uint8Array(output))) }
  } catch (error) {
    if ((error as Error).name === 'NotAllowedError') throw new Error('Passkey cancelled')

    console.warn('[passkey] PRF unavailable, using device wallet', error)
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
