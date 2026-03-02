# My Hustle Services - Quick Start Guide

## Quick Test

Test all services at once:
```bash
node test-hustle-services.js
```

## API Usage Examples

### 1. Update All Data
```bash
curl -X POST http://localhost:3001/api/hustle/update
```

### 2. Get Latest Feed Items
```bash
# Get latest 20 items
curl http://localhost:3001/api/hustle/feed?limit=20

# Get only yield opportunities
curl http://localhost:3001/api/hustle/feed?type=yield&limit=10

# Get only Optimism articles
curl http://localhost:3001/api/hustle/feed?source=optimism&limit=5
```

### 3. Get Statistics
```bash
curl http://localhost:3001/api/hustle/stats
```

### 4. Update Individual Sources
```bash
# Update only DefiLlama data
curl -X POST http://localhost:3001/api/hustle/update/defillama

# Update only RSS feeds
curl -X POST http://localhost:3001/api/hustle/update/rss
```

### 5. Clean Old Data
```bash
# Remove items older than 30 days
curl -X POST http://localhost:3001/api/hustle/clean/30
```

## Programmatic Usage

### Import and Use Services

```javascript
import myHustleService from './services/myhustle.service.js';

// Update all data
const result = await myHustleService.updateAllData();
console.log('Updated:', result);

// Get feed items
const items = await myHustleService.getHustleFeed({
  limit: 20,
  type: 'yield',
  sortBy: 'apy',
  sortOrder: 'desc'
});

// Get statistics
const stats = await myHustleService.getFeedStats();
```

### Use Individual Services

```javascript
import defiLlamaService from './services/defillama.service.js';
import rssService from './services/rss.service.js';

// Fetch stablecoin yields
const yields = await defiLlamaService.fetchStablecoinYields();

// Fetch airdrops
const airdrops = await defiLlamaService.fetchAirdrops();

// Parse RSS feeds
const articles = await rssService.parseAllFeeds();
```

## Data Flow

```
External APIs
    ↓
DefiLlama Service → hustle_feed (Firestore)
RSS Service       → hustle_feed (Firestore)
    ↓
My Hustle Service (Coordinator)
    ↓
API Endpoints
    ↓
Frontend UI
```

## Scheduled Updates

To run updates on a schedule, you can use:

### Option 1: Node.js Cron
```javascript
import cron from 'node-cron';
import myHustleService from './services/myhustle.service.js';

// Update every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Running scheduled hustle data update...');
  await myHustleService.updateAllData();
});
```

### Option 2: Firebase Cloud Functions
```javascript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import myHustleService from './services/myhustle.service.js';

export const updateHustleData = onSchedule('every 6 hours', async () => {
  await myHustleService.updateAllData();
});
```

### Option 3: System Cron (Linux/Mac)
```bash
# Add to crontab (crontab -e)
0 */6 * * * cd /path/to/CryptoExplorer && node -e "import('./services/myhustle.service.js').then(m => m.default.updateAllData())"
```

## Troubleshooting

### Issue: Fetch not defined
**Solution:** Ensure you're using Node.js 18+ which has native fetch support.

### Issue: Firebase not initialized
**Solution:** Check that `src/services/firebase.js` is properly configured with your Firebase credentials.

### Issue: RSS parsing fails
**Solution:** Check that the RSS feed URLs are accessible and haven't changed.

### Issue: Duplicate prevention not working
**Solution:** The RSS service uses article URLs as document IDs. Ensure URLs are consistent.

## Performance Tips

1. **Batch Operations**: Services use Firestore batch writes for efficiency
2. **Concurrent Fetching**: Multiple sources are fetched in parallel using Promise.allSettled
3. **Error Isolation**: If one service fails, others continue to work
4. **Deduplication**: RSS items use URL-based IDs to prevent duplicates

## Monitoring

Check the `hustle_updates` collection in Firestore to see:
- When updates were run
- Success/failure status of each service
- Number of items processed
- Duration of operations

## Next Steps

1. Set up scheduled updates (see above)
2. Integrate with frontend UI components
3. Add more RSS feeds or data sources as needed
4. Implement user-specific filtering and preferences
