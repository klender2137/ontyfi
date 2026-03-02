# Quick Fix Script for MyHustle Critical Errors
# Run this to fix the most critical issues preventing MyHustle from loading

## Step 1: Fix HTML Entities in MyHustle.js
The file contains `&#39;` instead of proper quotes. This causes a syntax error.

**Manual Fix Required:**
Open `public/MyHustle.js` and replace all instances of `&#39;` with `'`

Or run this command in PowerShell:
```powershell
(Get-Content public\MyHustle.js) -replace '&#39;', "'" | Set-Content public\MyHustle.js
```

## Step 2: Verify Firebase Admin SDK Service Account
Ensure the file exists:
`public/crypto-explorer-2137-firebase-adminsdk-fbsvc-0f3d6fb682.json`

If missing, download from Firebase Console:
1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Save as the filename above in the `public/` directory

## Step 3: Install Missing Dependencies
```bash
npm install firebase-admin rss-parser
```

## Step 4: Start the Backend Server
```bash
node server.js
```

Should see: `Backend running on http://localhost:3001`

## Step 5: Seed Initial Data
Once server is running, make a POST request:
```bash
curl -X POST http://localhost:3001/api/hustle/update
```

Or open browser and run in console:
```javascript
fetch('/api/hustle/update', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

## Step 6: Verify Data in Firestore
Check Firebase Console > Firestore Database
Should see `hustle_feed` collection with documents

## Step 7: Test MyHustle Screen
1. Open application in browser
2. Navigate to My Hustle screen
3. Should see data loading (not fallback message)

## Common Issues and Solutions

### Issue: "Unexpected token '<'"
**Solution:** HTML entities not fixed. Run Step 1 again.

### Issue: "Failed to fetch hustle data"
**Solution:** Backend not running. Run Step 4.

### Issue: "No data matches your current filters"
**Solution:** No data in Firestore. Run Step 5.

### Issue: "MetaMask extension not found"
**Solution:** This is a warning, not critical. Can be ignored or wrap in try-catch.

### Issue: Firebase Admin initialization failed
**Solution:** Service account file missing. Complete Step 2.

## Verification Checklist
- [ ] MyHustle.js has no HTML entities
- [ ] Firebase Admin SDK service account file exists
- [ ] Dependencies installed (firebase-admin, rss-parser)
- [ ] Backend server running on port 3001
- [ ] API endpoint responds: GET /api/hustle/feed
- [ ] Firestore has hustle_feed collection with data
- [ ] MyHustle screen loads without errors
- [ ] Data displays in cards (not sample data message)

## For Signup Page (Bonus)
The signup page doesn't exist yet. To create it:

1. Create `public/SignupScreen.js`
2. Add signup route in `main.js`
3. Add POST /api/auth/signup endpoint
4. Enable Email/Password auth in Firebase Console
5. Integrate with UserAccount system

This is a separate feature and not blocking MyHustle functionality.
