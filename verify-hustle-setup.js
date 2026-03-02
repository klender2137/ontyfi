// Verification script for My Hustle services setup
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== My Hustle Services Setup Verification ===\n');

let allChecksPass = true;

// Check 1: Service files exist
console.log('1. Checking service files...');
const serviceFiles = [
  'services/defillama.service.js',
  'services/rss.service.js',
  'services/myhustle.service.js',
  'services/firebase.admin.js'
];

serviceFiles.forEach(file => {
  const path = join(__dirname, file);
  if (existsSync(path)) {
    console.log(`   ✓ ${file}`);
  } else {
    console.log(`   ✗ ${file} - MISSING`);
    allChecksPass = false;
  }
});

// Check 2: Route files exist
console.log('\n2. Checking route files...');
const routeFiles = [
  'routes/hustle.routes.js'
];

routeFiles.forEach(file => {
  const path = join(__dirname, file);
  if (existsSync(path)) {
    console.log(`   ✓ ${file}`);
  } else {
    console.log(`   ✗ ${file} - MISSING`);
    allChecksPass = false;
  }
});

// Check 3: Firebase Admin service account
console.log('\n3. Checking Firebase Admin credentials...');
const serviceAccountPath = join(__dirname, 'public/crypto-explorer-2137-firebase-adminsdk-fbsvc-0f3d6fb682.json');
if (existsSync(serviceAccountPath)) {
  console.log('   ✓ Firebase Admin service account file found');
} else {
  console.log('   ✗ Firebase Admin service account file - MISSING');
  console.log('   → Place your service account JSON in: public/');
  allChecksPass = false;
}

// Check 4: Dependencies
console.log('\n4. Checking dependencies...');
try {
  await import('rss-parser');
  console.log('   ✓ rss-parser installed');
} catch (error) {
  console.log('   ✗ rss-parser - NOT INSTALLED');
  console.log('   → Run: npm install rss-parser');
  allChecksPass = false;
}

try {
  await import('firebase-admin');
  console.log('   ✓ firebase-admin installed');
} catch (error) {
  console.log('   ✗ firebase-admin - NOT INSTALLED');
  console.log('   → Run: npm install firebase-admin');
  allChecksPass = false;
}

// Check 5: Documentation files
console.log('\n5. Checking documentation...');
const docFiles = [
  'MY_HUSTLE_SERVICES.md',
  'HUSTLE_QUICK_START.md',
  'HUSTLE_IMPLEMENTATION_SUMMARY.md'
];

docFiles.forEach(file => {
  const path = join(__dirname, file);
  if (existsSync(path)) {
    console.log(`   ✓ ${file}`);
  } else {
    console.log(`   ⚠ ${file} - Missing (optional)`);
  }
});

// Check 6: Test script
console.log('\n6. Checking test script...');
const testScript = join(__dirname, 'test-hustle-services.js');
if (existsSync(testScript)) {
  console.log('   ✓ test-hustle-services.js');
} else {
  console.log('   ⚠ test-hustle-services.js - Missing (optional)');
}

// Summary
console.log('\n=== Verification Summary ===');
if (allChecksPass) {
  console.log('✓ All critical checks passed!');
  console.log('\nNext steps:');
  console.log('1. Start the server: npm start');
  console.log('2. Test the services: node test-hustle-services.js');
  console.log('3. Trigger an update: curl -X POST http://localhost:3001/api/hustle/update');
} else {
  console.log('✗ Some checks failed. Please fix the issues above.');
  process.exit(1);
}

console.log('\n=== Setup Information ===');
console.log('API Endpoints:');
console.log('  POST /api/hustle/update          - Update all data');
console.log('  GET  /api/hustle/feed            - Get feed items');
console.log('  GET  /api/hustle/stats           - Get statistics');
console.log('  POST /api/hustle/update/defillama - Update DefiLlama only');
console.log('  POST /api/hustle/update/rss      - Update RSS only');
console.log('\nDocumentation:');
console.log('  MY_HUSTLE_SERVICES.md            - Full technical docs');
console.log('  HUSTLE_QUICK_START.md            - Quick start guide');
console.log('  HUSTLE_IMPLEMENTATION_SUMMARY.md - Implementation summary');
