'use client'

import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import { metaMaskWallet, rabbyWallet, okxWallet, walletConnectWallet, injectedWallet } from '@rainbow-me/rainbowkit/wallets'
import { createConfig, http } from 'wagmi'
import { defineChain } from 'viem'
import { CHAIN_ID, RPC_URL, EXPLORER_URL, WC_PROJECT_ID } from './config'

export const appChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 10143 ? 'Monad Testnet' : CHAIN_ID === 31337 ? 'Anvil (local Monad)' : `Chain ${CHAIN_ID}`,
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'MonadVision', url: EXPLORER_URL } },
  testnet: true,
})

const connectors = connectorsForWallets(
  [{ groupName: 'Your wallet', wallets: [metaMaskWallet, rabbyWallet, okxWallet, walletConnectWallet, injectedWallet] }],
  { appName: 'DuckWek', projectId: WC_PROJECT_ID },
)

export const config = createConfig({
  connectors,
  chains: [appChain],
  transports: { [appChain.id]: http(RPC_URL) },
  ssr: true,
})
