import { Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from './wagmi.js';
import ErrorBoundary from './components/ErrorBoundary'
import LoadingSkeleton from './components/LoadingSkeleton'
import Home from './components/Home'
import TreeMap from './components/TreeMap'
import HustleFeed from './components/HustleFeed'
import MyHustleScreen from './components/MyHustleScreen'

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ErrorBoundary>
            <Router>
              <div style={{ 
                background: '#0f172a', 
                color: '#f7f9ff',
                minHeight: '100vh',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
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
              </div>
            </Router>
          </ErrorBoundary>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App