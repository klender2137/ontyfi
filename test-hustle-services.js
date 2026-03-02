// Test script for My Hustle data services
import myHustleService from './services/myhustle.service.js';

async function testServices() {
  console.log('=== Testing My Hustle Data Services ===\n');

  try {
    // Test full data update
    console.log('1. Testing full data update...');
    const result = await myHustleService.updateAllData();
    console.log('✓ Update completed:', JSON.stringify(result, null, 2));

    // Test getting feed data
    console.log('\n2. Testing feed retrieval...');
    const feed = await myHustleService.getHustleFeed({ limit: 10 });
    console.log(`✓ Retrieved ${feed.length} items`);
    if (feed.length > 0) {
      console.log('Sample item:', JSON.stringify(feed[0], null, 2));
    }

    // Test getting stats
    console.log('\n3. Testing statistics...');
    const stats = await myHustleService.getFeedStats();
    console.log('✓ Stats:', JSON.stringify(stats, null, 2));

    console.log('\n=== All tests passed! ===');
    process.exit(0);

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testServices();
