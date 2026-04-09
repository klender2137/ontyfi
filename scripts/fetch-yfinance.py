import yfinance as yf
import json
import sys
import random

# S&P 500 tickers list
sp500_tickers = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'BRK-B', 'JPM', 'V',
    'UNH', 'HD', 'PG', 'JNJ', 'MA', 'CVX', 'LLY', 'PFE', 'KO', 'PEP',
    'TMO', 'BAC', 'AVGO', 'WMT', 'XOM', 'COST', 'ABT', 'CRM', 'ACN', 'DHR',
    'MRK', 'LIN', 'NKE', 'TXN', 'NEE', 'NOW', 'QCOM', 'UPS', 'HON', 'ADBE',
    'AMD', 'CMCSA', 'NFLX', 'INTC', 'CSCO', 'T', 'VZ', 'DIS', 'PYPL', 'INTU',
    'GS', 'MS', 'CAT', 'RTX', 'GE', 'BA', 'MMM', 'IBM', 'ORCL', 'DE'
]

def fetch_random_tickers(count=30):
    """Fetch data for random S&P 500 tickers using yfinance"""
    
    # Get random tickers
    random_tickers = random.sample(sp500_tickers, min(count, len(sp500_tickers)))
    print(f"Fetching data for {len(random_tickers)} random tickers: {', '.join(random_tickers)}", file=sys.stderr)
    
    data = []
    
    for symbol in random_tickers:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            history = ticker.history(period='2d')  # Get 2 days to calculate change
            
            if not history.empty and info:
                current_price = history['Close'].iloc[-1]
                prev_price = history['Close'].iloc[-2] if len(history) > 1 else current_price * 0.98  # Fallback if only 1 day
                change_percent = ((current_price - prev_price) / prev_price) * 100
                
                data.append({
                    'symbol': symbol,
                    'price': round(float(current_price), 2),
                    'change': round(float(change_percent), 2),
                    'name': info.get('shortName') or info.get('longName') or symbol
                })
            else:
                # Fallback data
                data.append({
                    'symbol': symbol,
                    'price': round(100 + hash(symbol) % 400, 2),
                    'change': round((hash(symbol) % 20 - 10), 2),
                    'name': symbol
                })
        except Exception as e:
            print(f'Error fetching {symbol}: {e}', file=sys.stderr)
            # Fallback data
            data.append({
                'symbol': symbol,
                'price': round(100 + hash(symbol) % 400, 2),
                'change': round((hash(symbol) % 20 - 10), 2),
                'name': symbol
            })
    
    return data

if __name__ == "__main__":
    try:
        # Get count from command line argument, default to 30
        count = int(sys.argv[1]) if len(sys.argv) > 1 else 30
        count = max(5, min(count, 50))  # Clamp between 5 and 50
        
        ticker_data = fetch_random_tickers(count)
        print(json.dumps(ticker_data))
    except Exception as e:
        print(f"Script error: {e}", file=sys.stderr)
        # Return minimal fallback data
        fallback_data = [{'symbol': 'ERROR', 'price': 0, 'change': 0, 'name': 'Error'}]
        print(json.dumps(fallback_data))
