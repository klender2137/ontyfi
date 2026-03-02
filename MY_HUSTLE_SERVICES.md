# My Hustle Data Services

This document describes the data services implemented for the "My Hustle" feature, which aggregates crypto opportunities from multiple external sources.

## Overview

The My Hustle system consists of three main service modules:

1. **DefiLlama Service** - Fetches DeFi yields and airdrops
2. **RSS Parser Service** - Fetches articles from Optimism and Arbitrum blogs
3. **My Hustle Service** - Coordinates all data sources and manages the hustle_feed collection

## Services

### 1. DefiLlama Service (`services/defillama.service.js`)

Fetches data from DefiLlama APIs and saves to Firestore.

#### Functions:

- **`fetchStablecoinYields()`**
  - Fetches from: `https://yields.llama.fi/pools`
  - Filters: `stablecoin: true`
  - Sorts: By APY descending
  - Returns: Top 20 stablecoin yield opportunities

- **`fetchAirdrops()`**
  - Fetches from: `https://api.llama.fi/airdrops`
  - Maps: `name` and `description` fields
  - Returns: All available airdrops

- **`saveToHustleFeed(data)`**
  - Saves data to Firestore `hustle_feed` collection
  - Uses batch writes for efficiency

- **`fetchAndSaveAll()`**
  - Fetches both yields and airdrops
  - Saves all data to Firestore
  - Returns summary of operation

### 2. RSS Parser Service (`services/rss.service.js`)

Parses RSS feeds from Layer 2 ecosystem blogs.

#### RSS Feeds:
- Optimism: `https://optimism.mirror.xyz/feed/atom`
- Arbitrum: `https://blog.arbitrum.foundation/feed`

#### Functions:

- **`parseFeed(feedUrl, source)`**
  - Parses a single RSS feed
  - Returns latest 5 items
  - Transforms to hustle_feed format

- **`parseAllFeeds()`**
  - Parses all configured RSS feeds concurrently
  - Returns combined array of items

- **`saveToHustleFeed(data)`**
  - Saves RSS items to Firestore
  - Uses article URL as document ID to prevent duplicates
  - Skips items that already exist

- **`fetchAndSaveAll()`**
  - Fetches and saves all RSS data
  - Returns summary with saved/skipped counts

### 3. My Hustle Service (`services/myhustle.service.js`)

Main coordinator service that manages all data sources.

#### Functions:

- **`updateAllData()`**
  - Updates data from all sources (DefiLlama + RSS)
  - Runs services concurrently for efficiency
  - Saves operation summary to `hustle_updates` collection

- **`updateDefiLlamaData()`**
  - Updates only DefiLlama data

- **`updateRSSData()`**
  - Updates only RSS data

- **`getHustleFeed(options)`**
  - Retrieves data from hustle_feed collection
  - Options: `limit`, `type`, `source`, `sortBy`, `sortOrder`

- **`getFeedStats()`**
  - Returns statistics about the hustle_feed collection
  - Includes counts by type and source

- **`cleanOldItems(daysOld)`**
  - Maintenance function to remove old items
  - Default: 30 days

## API Endpoints

All endpoints are prefixed with `/api/hustle`:

### POST `/api/hustle/update`
Update all hustle data (DefiLlama + RSS)

**Response:**
```json
{
  "success": true,
  "message": "Hustle data updated successfully",
  "data": {
    "duration": 2345,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "services": {
      "defiLlama": {
        "status": "success",
        "yieldsCount": 20,
        "airdropsCount": 15,
        "totalSaved": 35
      },
      "rss": {
        "status": "success",
        "itemsParsed": 10,
        "saved": 8,
        "skipped": 2
      }
    }
  }
}
```

### GET `/api/hustle/feed`
Get hustle feed data

**Query Parameters:**
- `limit` (default: 50) - Number of items to return
- `type` - Filter by type (yield, airdrop, article)
- `source` - Filter by source (defillama, optimism, arbitrum)
- `sortBy` (default: timestamp) - Field to sort by
- `sortOrder` (default: desc) - Sort order

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 50
}
```

### GET `/api/hustle/stats`
Get hustle feed statistics

**Response:**
```json
{
  "success": true,
  "data": {
    "totalItems": 100,
    "byType": {
      "yield": 20,
      "airdrop": 15,
      "article": 65
    },
    "bySource": {
      "defillama": 35,
      "optimism": 35,
      "arbitrum": 30
    },
    "latestUpdate": "2024-01-15T10:30:00.000Z"
  }
}
```

### POST `/api/hustle/update/defillama`
Update only DefiLlama data

### POST `/api/hustle/update/rss`
Update only RSS data

### POST `/api/hustle/clean/:days`
Clean items older than specified days

## Data Structure

### hustle_feed Collection

Each document in the `hustle_feed` collection has the following structure:

#### Yield Items (from DefiLlama)
```javascript
{
  id: "yield_pool123",
  type: "yield",
  title: "USDC on Aave",
  description: "APY: 5.23% | TVL: $1,234,567",
  source: "defillama",
  url: "https://defillama.com/yields/pool/...",
  apy: 5.23,
  tvl: 1234567,
  symbol: "USDC",
  project: "Aave",
  timestamp: Timestamp,
  tags: ["yield", "stablecoin", "aave"]
}
```

#### Airdrop Items (from DefiLlama)
```javascript
{
  id: "airdrop_project_name",
  type: "airdrop",
  title: "Project Name",
  description: "Airdrop description...",
  source: "defillama",
  url: "https://...",
  timestamp: Timestamp,
  tags: ["airdrop", "opportunity"]
}
```

#### Article Items (from RSS)
```javascript
{
  id: "rss_optimism_article_url",
  type: "article",
  title: "Article Title",
  description: "Article description...",
  content: "Full article content...",
  source: "optimism",
  url: "https://optimism.mirror.xyz/...",
  author: "Optimism",
  publishedAt: Timestamp,
  timestamp: Timestamp,
  tags: ["article", "optimism", "layer2", "op-stack"]
}
```

## Testing

Run the test script to verify all services:

```bash
node test-hustle-services.js
```

This will:
1. Fetch data from all sources
2. Save to Firestore
3. Retrieve and display sample data
4. Show statistics

## Dependencies

- `rss-parser` - For parsing RSS feeds
- `firebase-admin` - For Firestore database access
- Native `fetch` API (Node.js 18+) - For HTTP requests

## Notes

- RSS feed uses article URLs as document IDs to prevent duplicates
- All services use batch writes for efficiency
- Error handling is implemented with Promise.allSettled for concurrent operations
- Update summaries are saved to `hustle_updates` collection for tracking
- Services can be run independently or together via the main coordinator
