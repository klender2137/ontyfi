// wagmi.js - Wagmi configuration for Web3 auth
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';
import { solana, solanaDevnet } from '@rainbow-me/rainbowkit-solana'; // Assuming this exists, or use custom

export const config = getDefaultConfig({
  appName: 'Crypto Explorer',
  projectId: 'f8cb8d5d5d3f026da76336d47b706b67', // Provided by user
  chains: [mainnet, polygon, optimism, arbitrum, base, solana, solanaDevnet],
  ssr: false, // If your dApp uses server side rendering (SSR)
});
