import { Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from './wagmi.js';
import ErrorBoundary from './components/ErrorBoundary'
import LoadingSkeleton from './components/LoadingSkeleton'
import AuthScreen from './components/AuthScreen'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import SolanaWalletProvider from './components/SolanaWalletProvider'
import Home from './components/Home'
import TreeMap from './components/TreeMap'
import HustleFeed from './components/HustleFeed'
import MyHustleScreen from './components/MyHustleScreen'

const queryClient = new QueryClient();

function AppRoutes() {
  const { initializing, isAuthenticated, isGuest } = useAuth();

  if (initializing) {
    return <LoadingSkeleton />;
  }

  if (!isAuthenticated && !isGuest) {
    return <AuthScreen />;
  }

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tree" element={
          <ErrorBoundary>
            <TreeMap />
          </ErrorBoundary>
        } />
        <Route path="/hustle" element={
          <ErrorBoundary>
            <HustleFeed />
          </ErrorBoundary>
        } />
        <Route path="/my-hustle" element={
          <ErrorBoundary>
            <MyHustleScreen />
          </ErrorBoundary>
        } />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <SolanaWalletProvider>
            <AuthProvider>
              <ErrorBoundary>
                <Router>
                  <div style={{ 
                    background: '#0f172a', 
                    color: '#f7f9ff',
                    minHeight: '100vh',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    <AppRoutes />
                  </div>
                </Router>
              </ErrorBoundary>
            </AuthProvider>
          </SolanaWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App