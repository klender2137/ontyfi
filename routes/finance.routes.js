import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = express.Router();
const execAsync = promisify(exec);

// Simple in-memory cache for ticker data
const tickerCache = new Map();
const CACHE_TTL = 30000; // 30 seconds for real-time feel

// S&P 500 tickers list
const sp500Tickers = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'BRK-B', 'JPM', 'V',
  'UNH', 'HD', 'PG', 'JNJ', 'MA', 'CVX', 'LLY', 'PFE', 'KO', 'PEP',
  'TMO', 'BAC', 'AVGO', 'WMT', 'XOM', 'COST', 'ABT', 'CRM', 'ACN', 'DHR',
  'MRK', 'LIN', 'NKE', 'TXN', 'NEE', 'NOW', 'QCOM', 'UPS', 'HON', 'ADBE',
  'AMD', 'CMCSA', 'NFLX', 'INTC', 'CSCO', 'T', 'VZ', 'DIS', 'PYPL', 'INTU',
  'GS', 'MS', 'CAT', 'RTX', 'GE', 'BA', 'MMM', 'IBM', 'ORCL', 'DE'
];

// Helper function to get random tickers
function getRandomTickers(count = 30) {
  const shuffled = [...sp500Tickers].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper function to generate mock data (fallback only)
function generateMockData(tickers) {
  return tickers.map(symbol => ({
    symbol,
    price: Math.floor(Math.random() * 500) + 100,
    change: parseFloat((Math.random() * 10 - 5).toFixed(2)),
    name: symbol
  }));
}

// Helper to get cached or fresh data
function getCachedData(key) {
  const cached = tickerCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  tickerCache.set(key, { data, timestamp: Date.now() });
}

router.get('/tickers', async (req, res) => {
  try {
    const count = Math.min(Math.max(parseInt(req.query.count) || 30, 5), 50);
    const cacheKey = `tickers_${count}`;
    
    console.log(`[Finance API] Fetching ${count} random S&P 500 tickers using yfinance`);
    
    // Check cache first for real-time performance
    const cached = getCachedData(cacheKey);
    if (cached) {
      console.log(`[Finance API] Returning cached data for ${count} tickers`);
      res.json({ ok: true, data: cached, cached: true });
      return;
    }
    
    // Try to use Python yfinance library with count parameter
    try {
      const { stdout, stderr } = await execAsync(`python scripts/fetch-yfinance.py ${count}`);
      
      if (stderr) {
        console.warn('[Finance API] Python stderr:', stderr);
      }
      
      const tickerData = JSON.parse(stdout);
      console.log(`[Finance API] Successfully fetched ${tickerData.length} tickers via yfinance`);
      
      // Cache the results
      setCachedData(cacheKey, tickerData);
      
      res.json({ ok: true, data: tickerData, source: 'yfinance' });
      return;
      
    } catch (pythonError) {
      console.warn('[Finance API] Python yfinance failed:', pythonError.message);
    }
    
    // Fallback to mock data
    const randomTickers = getRandomTickers(count);
    const mockData = generateMockData(randomTickers);
    
    console.log(`[Finance API] Using mock data for ${count} random S&P 500 tickers`);
    setCachedData(cacheKey, mockData);
    res.json({ ok: true, data: mockData, source: 'mock' });
    
  } catch (error) {
    console.error('[Finance API] Critical error in ticker endpoint:', error);
    
    // Ultimate fallback - always return data
    const count = parseInt(req.query.count) || 30;
    const emergencyTickers = getRandomTickers(count);
    const emergencyData = generateMockData(emergencyTickers);
    
    res.json({ ok: true, data: emergencyData, source: 'emergency' });
  }
});

export default router;
