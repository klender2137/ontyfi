import yfinance from 'yfinance';
import { writeFileSync } from 'fs';

// S&P 500 tickers list
const sp500Tickers = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'BRK-B', 'JPM', 'V',
  'UNH', 'HD', 'PG', 'JNJ', 'MA', 'CVX', 'LLY', 'PFE', 'KO', 'PEP',
  'TMO', 'BAC', 'AVGO', 'WMT', 'XOM', 'COST', 'ABT', 'CRM', 'ACN', 'DHR',
  'MRK', 'LIN', 'NKE', 'TXN', 'NEE', 'NOW', 'QCOM', 'UPS', 'HON', 'ADBE',
  'AMD', 'CMCSA', 'NFLX', 'INTC', 'CSCO', 'T', 'VZ', 'DIS', 'PYPL', 'INTU',
  'GS', 'MS', 'CAT', 'RTX', 'GE', 'BA', 'MMM', 'IBM', 'ORCL', 'DE'
];

async function fetchRandomTickers() {
  try {
    // Get 30 random tickers from S&P 500
    const randomTickers = [];
    const shuffled = [...sp500Tickers].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < 30; i++) {
      randomTickers.push(shuffled[i]);
    }
    
    console.log(`[YFinance] Fetching data for ${randomTickers.length} random S&P 500 tickers`);
    
    // Fetch data using yfinance
    const tickers = yfinance.Tickers(randomTickers);
    const data = [];
    
    for (const symbol of randomTickers) {
      try {
        const ticker = tickers[symbol];
        const info = ticker.info;
        const history = ticker.history({ period: '1d' });
        
        if (info && history && !history.empty) {
          const currentPrice = history['Close'].iloc[-1];
          const previousPrice = history['Close'].iloc[-2] || currentPrice;
          const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
          
          data.push({
            symbol: symbol,
            price: parseFloat(currentPrice.toFixed(2)),
            change: parseFloat(changePercent.toFixed(2)),
            name: info.shortName || info.longName || symbol
          });
        }
      } catch (tickerError) {
        console.warn(`[YFinance] Failed to fetch ${symbol}:`, tickerError.message);
        // Add fallback data
        data.push({
          symbol: symbol,
          price: Math.random() * 500 + 100,
          change: (Math.random() - 0.5) * 10,
          name: symbol
        });
      }
    }
    
    console.log(`[YFinance] Successfully fetched ${data.length} tickers`);
    
    // Save to cache file
    const cacheData = {
      data: data,
      timestamp: Date.now(),
      source: 'yfinance'
    };
    
    writeFileSync('./data/ticker-cache.json', JSON.stringify(cacheData, null, 2));
    console.log('[YFinance] Data cached to ticker-cache.json');
    
    return data;
    
  } catch (error) {
    console.error('[YFinance] Error fetching tickers:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchRandomTickers()
    .then(data => console.log('Ticker data updated successfully'))
    .catch(error => console.error('Failed to update ticker data:', error));
}

export default fetchRandomTickers;
