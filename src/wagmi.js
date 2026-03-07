// wagmi.js - Wagmi configuration for Web3 auth
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';
import { solana, solanaDevnet } from '@rainbow-me/rainbowkit-solana'; // Assuming this exists, or use custom
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { auth as firebaseAuth } from '../services/firebase';

export const config = getDefaultConfig({
  appName: 'Crypto Explorer',
  projectId: 'f8cb8d5d5d3f026da76336d47b706b67', // Provided by user
  chains: [mainnet, polygon, optimism, arbitrum, base, solana, solanaDevnet],
  siweConfig: {
    getNonce: async () => {
      const res = await fetch('/api/ethereum-auth/nonce');
      const data = await res.json();
      return data.nonce;
    },
    createMessage: ({ nonce, address, chainId }) => ({
      domain: window.location.host,
      address,
      statement: 'Sign in with Ethereum to CryptoExplorer.',
      uri: window.location.origin,
      version: '1',
      chainId,
      nonce,
    }),
    verifyMessage: async ({ message, signature }) => {
      try {
        const res = await fetch('/api/ethereum-auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, signature }),
        });
        const data = await res.json();
        if (data.token) {
          await signInWithCustomToken(firebaseAuth, data.token);
          return true;
        }
        return false;
      } catch (error) {
        console.error('SIWE verify error:', error);
        return false;
      }
    },
    signOutOnAccountChange: true,
    signOutOnNetworkChange: false,
  },
  ssr: false, // If your dApp uses server side rendering (SSR)
});
