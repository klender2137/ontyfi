# MyHustle Screen - Core Related Files

## FRONTEND FILES

### Main Component
- `public/MyHustle.js` - Main MyHustle screen component with UI

### Integration Files
- `public/main.js` - App router, includes MyHustle screen state handling
- `public/index.html` - Loads MyHustle.js script

## BACKEND FILES

### API Routes
- `routes/hustle.routes.js` - API endpoints for MyHustle data
  - GET /api/hustle/feed
  - POST /api/hustle/update
  - GET /api/hustle/stats
  - POST /api/hustle/update/defillama
  - POST /api/hustle/update/rss
  - POST /api/hustle/clean/:days

### Services
- `services/myhustle.service.js` - Main coordinator service
- `services/defillama.service.js` - Fetches yield/airdrop data from DefiLlama
- `services/rss.service.js` - Fetches articles from RSS feeds
- `services/firebase-admin.js` - Firebase Admin SDK initialization

### Server Configuration
- `app.js` - Express app with route mounting
- `server.js` - Server startup

## DATABASE

### Firestore Collections
- `hustle_feed` - Stores all MyHustle items (yields, airdrops, articles)
- `hustle_updates` - Stores update operation summaries

## DEPENDENCIES

### Required npm Packages
- `firebase-admin` - Backend Firebase SDK
- `rss-parser` - RSS feed parsing
- `cors` - CORS middleware
- `express` - Web framework

## CONFIGURATION FILES

### Firebase
- `public/crypto-explorer-2137-firebase-adminsdk-fbsvc-0f3d6fb682.json` - Service account key

## DOCUMENTATION

- `MY_HUSTLE_SERVICES.md` - Service documentation
- `MYHUSTLE_CRITICAL_ERRORS_ANALYSIS.md` - Error analysis
- `QUICK_FIX_GUIDE.md` - Setup guide
- `TEST_RESULTS.md` - Test results

## TOTAL: 17 FILES

### Critical Path (Must Work):
1. public/MyHustle.js
2. routes/hustle.routes.js
3. services/myhustle.service.js
4. services/defillama.service.js
5. services/rss.service.js
6. services/firebase-admin.js
7. app.js
8. server.js
