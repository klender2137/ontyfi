# My Hustle Services - Deployment Checklist

## ✅ Pre-Deployment Verification

Run the verification script:
```bash
node verify-hustle-setup.js
```

All checks should pass before proceeding.

## 📋 Deployment Steps

### 1. Environment Setup ✅
- [x] Node.js 18+ installed
- [x] Firebase Admin SDK credentials configured
- [x] All dependencies installed (`npm install`)
- [x] Service files in place
- [x] Route files configured

### 2. Firebase Configuration ✅
- [x] Firebase Admin service account JSON file present
- [x] Firestore database created
- [x] Collections will be auto-created on first write:
  - `hustle_feed` - Main data collection
  - `hustle_updates` - Update tracking

### 3. Test Services Locally

Start the server:
```bash
npm start
```

Test the services:
```bash
node test-hustle-services.js
```

Expected output:
- ✓ DefiLlama yields fetched (20 items)
- ✓ DefiLlama airdrops fetched
- ✓ RSS feeds parsed (10 items total)
- ✓ Data saved to Firestore
- ✓ Statistics calculated

### 4. Test API Endpoints

Update all data:
```bash
curl -X POST http://localhost:3001/api/hustle/update
```

Get feed items:
```bash
curl http://localhost:3001/api/hustle/feed?limit=10
```

Get statistics:
```bash
curl http://localhost:3001/api/hustle/stats
```

### 5. Verify Firestore Data

Check Firestore console:
1. Go to Firebase Console → Firestore Database
2. Verify `hustle_feed` collection exists
3. Check sample documents:
   - Yield items (type: "yield")
   - Airdrop items (type: "airdrop")
   - Article items (type: "article")
4. Verify `hustle_updates` collection for tracking

### 6. Set Up Scheduled Updates (Optional)

Choose one method:

#### Option A: Node.js Cron
```bash
npm install node-cron
```

Add to your server.js:
```javascript
import cron from 'node-cron';
import myHustleService from './services/myhustle.service.js';

// Update every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Running scheduled hustle data update...');
  await myHustleService.updateAllData();
});
```

#### Option B: Firebase Cloud Functions
Deploy as a scheduled function:
```javascript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import myHustleService from './services/myhustle.service.js';

export const updateHustleData = onSchedule('every 6 hours', async () => {
  await myHustleService.updateAllData();
});
```

#### Option C: External Cron Service
Use services like:
- Cron-job.org
- EasyCron
- AWS EventBridge

Configure to call:
```
POST http://your-domain.com/api/hustle/update
```

### 7. Frontend Integration

Add to your React components:
```javascript
// Fetch hustle feed
const response = await fetch('/api/hustle/feed?limit=20');
const data = await response.json();

// Display items
data.data.forEach(item => {
  console.log(item.title, item.type, item.source);
});
```

See `public/hustle/ui/hustle-integration-example.js` for complete examples.

### 8. Monitoring Setup

Monitor these metrics:
- Update frequency (check `hustle_updates` collection)
- Success/failure rates
- Number of items per source
- API response times
- Firestore read/write operations

### 9. Error Handling

The services include comprehensive error handling:
- Individual service failures don't affect others
- All errors are logged to console
- API returns proper error responses
- Failed updates are tracked in `hustle_updates`

### 10. Maintenance

Regular tasks:
- Monitor Firestore usage
- Clean old items periodically:
  ```bash
  curl -X POST http://localhost:3001/api/hustle/clean/30
  ```
- Check for API changes (DefiLlama, RSS feeds)
- Review update logs in `hustle_updates` collection

## 🔍 Troubleshooting

### Issue: "Firebase Admin not initialized"
**Solution:** Check that the service account JSON file exists and path is correct in `services/firebase.admin.js`

### Issue: "Fetch is not defined"
**Solution:** Ensure Node.js 18+ is installed. Check version: `node --version`

### Issue: "RSS parsing failed"
**Solution:** 
- Check RSS feed URLs are accessible
- Verify network connectivity
- Check if feed format has changed

### Issue: "DefiLlama API error"
**Solution:**
- Check API endpoints are still valid
- Verify network connectivity
- Check if API rate limits apply

### Issue: "Firestore permission denied"
**Solution:**
- Verify Firebase Admin credentials
- Check Firestore security rules
- Ensure service account has proper permissions

## 📊 Success Metrics

After deployment, verify:
- [ ] Data updates successfully every 6 hours (or your schedule)
- [ ] `hustle_feed` collection contains fresh data
- [ ] API endpoints respond within 2 seconds
- [ ] No errors in server logs
- [ ] Frontend displays data correctly
- [ ] Statistics show expected counts

## 🎯 Performance Benchmarks

Expected performance:
- **DefiLlama fetch:** 2-5 seconds
- **RSS parsing:** 3-7 seconds
- **Total update time:** 5-15 seconds
- **API response time:** < 500ms
- **Firestore writes:** Batch operations, < 2 seconds

## 📝 Post-Deployment

1. Document your deployment date
2. Set up monitoring alerts
3. Schedule regular maintenance
4. Plan for scaling if needed
5. Gather user feedback

## 🚀 You're Ready!

Once all steps are complete:
- ✅ Services are running
- ✅ Data is updating
- ✅ API is responding
- ✅ Frontend is integrated
- ✅ Monitoring is active

Your My Hustle data services are live and operational!

## 📞 Support

For issues or questions:
1. Check the documentation:
   - `MY_HUSTLE_SERVICES.md` - Technical details
   - `HUSTLE_QUICK_START.md` - Quick reference
   - `HUSTLE_IMPLEMENTATION_SUMMARY.md` - Overview

2. Review the logs:
   - Server console output
   - Firestore `hustle_updates` collection
   - Browser console (for frontend)

3. Test individual components:
   - Run `node test-hustle-services.js`
   - Test API endpoints with curl
   - Check Firestore directly

## 🎉 Congratulations!

Your My Hustle data services are successfully deployed and ready to provide crypto opportunities to your users!
