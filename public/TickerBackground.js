(function() {
  const { useState, useEffect, useCallback, useMemo, useRef } = React;

  /**
   * TickerBackground - Animated background stock ticker component
   * Displays scrolling stock prices with real-time updates from Yahoo Finance
   * 
   * Props:
   * - updateInterval: Update interval in ms (default: 30000)
   * - tickerCount: Number of tickers to display (default: 30)
   * - opacity: Overlay opacity 0-1 (default: 0.4)
   */
  function TickerBackground({ 
    updateInterval = 30000, 
    tickerCount = 30, 
    opacity = 0.4 
  }) {
    const [tickers, setTickers] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    const fetchTickers = useCallback(async () => {
      try {
        const response = await fetch(`/api/finance/tickers?count=${tickerCount}`);
        const result = await response.json();
        if (result.ok) {
          console.log('[TickerBackground] Tickers loaded:', result.data.length, 'symbols');
          setTickers(result.data);
          setLastUpdate(Date.now());
        } else {
          console.warn('[TickerBackground] API error:', result.error);
          if (tickers.length === 0) setTickers([]);
        }
      } catch (err) {
        console.warn('[TickerBackground] Fetch failed:', err);
      }
    }, [tickerCount, tickers.length]);

    // Initial fetch and interval setup
    useEffect(() => {
      fetchTickers();
      const interval = setInterval(fetchTickers, updateInterval);
      return () => clearInterval(interval);
    }, [fetchTickers, updateInterval]);

    // Prepare ticker items
    const tickerItems = useMemo(() => {
      if (!tickers || tickers.length === 0) return [];
      return tickers.map((ticker, idx) => {
        const text = `${ticker.symbol}: $${ticker.price.toFixed(2)} (${ticker.change >= 0 ? '+' : ''}${ticker.change.toFixed(2)}%)`;
        return { ticker, idx, text, key: `${ticker.symbol}-${lastUpdate}-${idx}` };
      });
    }, [tickers, lastUpdate]);

    if (tickerItems.length === 0) return null;

    return React.createElement('div', {
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        opacity: opacity,
        overflow: 'hidden'
      }
    }, [
      // Ticker elements
      ...tickerItems.map(({ ticker, idx, text, key }) => {
        const animationDuration = 20 + (idx % 10) * 5;
        const topPosition = ((idx * 7) % 100);
        
        return React.createElement('div', {
          key: key,
          style: {
            position: 'absolute',
            color: ticker.change >= 0 ? '#4ade80' : '#f87171',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            top: `${topPosition}%`,
            left: '-200px',
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(0,0,0,0.5)',
            animation: `ticker-commute ${animationDuration}s linear infinite`,
            animationDelay: `${(idx * 2) % 10}s`
          }
        }, text);
      }),
      
      // Style element for animation
      React.createElement('style', {
        key: 'ticker-styles'
      }, `
        @keyframes ticker-commute { 
          from { transform: translateX(-100%); } 
          to { transform: translateX(calc(100vw + 400px)); } 
        }
      `)
    ]);
  }

  // Export for use in other components
  window.TickerBackground = TickerBackground;
})();
