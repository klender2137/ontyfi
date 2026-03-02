// useWeb3Auth.js - Custom hook for Web3 authentication with SIWE/SIWS
import { useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { SiweMessage } from 'siwe';
import { signInWithCustomToken, getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth as getFirebaseAuth } from 'firebase/auth';

// Firebase config, assuming same as in firebase.js
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getFirebaseAuth(app);

export function useWeb3Auth() {
  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { publicKey, signMessage } = useWallet();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (((isConnected && address) || publicKey) && !isAuthenticating) {
      authenticate();
    }
  }, [isConnected, address, publicKey]);

  const authenticate = async () => {
    setIsAuthenticating(true);

    try {
      if (address && chain) {
        // EVM SIWE
        const message = new SiweMessage({
          domain: window.location.host,
          address,
          statement: 'Sign in with Ethereum to CryptoExplorer.',
          uri: window.location.origin,
          version: '1',
          chainId: chain.id,
          nonce: Math.random().toString(36).substring(2),
        });

        const messageToSign = message.prepareMessage();
        const signature = await signMessageAsync({ message: messageToSign });

        // Store signature
        localStorage.setItem('walletSignature', signature);

        // Send to backend
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageToSign, signature, address, chainId: chain.id }),
        });

        if (!response.ok) throw new Error('Verification failed');

        const { customToken } = await response.json();

        // Sign into Firebase
        await signInWithCustomToken(auth, customToken);
        setIsAuthenticated(true);
        console.log('Authenticated with Firebase');
      } else if (publicKey && signMessage) {
        // Solana SIWS
        const nonce = Math.random().toString(36).substring(2);
        const issuedAt = new Date().toISOString();
        const message = `Sign in to CryptoExplorer with your Solana wallet.\n\nDomain: ${window.location.host}\nAddress: ${publicKey.toBase58()}\nStatement: Sign in with Solana to CryptoExplorer.\nURI: ${window.location.origin}\nVersion: 1\nChain ID: solana\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

        const encodedMessage = new TextEncoder().encode(message);
        const signature = await signMessage(encodedMessage);

        // Store signature as base64
        const signatureB64 = btoa(String.fromCharCode(...signature));
        localStorage.setItem('walletSignature', signatureB64);

        // Send to backend
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, signature: signatureB64, address: publicKey.toBase58(), chainId: 'solana' }),
        });

        if (!response.ok) throw new Error('Verification failed');

        const { customToken } = await response.json();

        // Sign into Firebase
        await signInWithCustomToken(auth, customToken);
        setIsAuthenticated(true);
        console.log('Authenticated with Firebase');
      }
    } catch (error) {
      console.error('Authentication failed:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return { isAuthenticating, isAuthenticated };
}
