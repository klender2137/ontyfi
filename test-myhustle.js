// Test script for My Hustle data services
// Run with: node test-myhustle.js

const myHustleService = require('./services/myhustle.service');

async function testMyHustleServices() {
  try {
    console.log('🚀 Starting My Hustle Services Test...\n');

    // Test 1: Update all data
    console.log('📊 Test 1: Updating all data sources...');
    const updateResult = await myHustleService.updateAllData();
    console.log('✅ Update Results:', JSON.stringify(updateResult, null, 2));
    console.log('');

    // Test 2: Get current feed stats
    console.log('📈 Test 2: Getting feed statistics...');
    const stats = await myHustleService.getFeedStats();
    console.log('✅ Feed Stats:', JSON.stringify(stats, null, 2));
    console.log('');

    // Test 3: Get recent items from feed
    console.log('📰 Test 3: Getting recent feed items...');
    const recentItems = await myHustleService.getHustleFeed({ limit: 10 });
    console.log(`✅ Retrieved ${recentItems.length} recent items:`);
    recentItems.forEach((item, index) => {
      console.log(`  ${index + 1}. [${item.type}] ${item.title} (${item.source})`);
    });
    console.log('');

    // Test 4: Get only yield items
    console.log('💰 Test 4: Getting only yield items...');
    const yieldItems = await myHustleService.getHustleFeed({
      limit: 5,
      type: 'yield'
    });
    console.log(`✅ Retrieved ${yieldItems.length} yield items:`);
    yieldItems.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.title} - ${item.description}`);
    });
    console.log('');

    // Test 5: Get only RSS articles
    console.log('📰 Test 5: Getting only article items...');
    const articleItems = await myHustleService.getHustleFeed({
      limit: 5,
      type: 'article'
    });
    console.log(`✅ Retrieved ${articleItems.length} article items:`);
    articleItems.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.title} (${item.source})`);
    });
    console.log('');

    console.log('🎉 All My Hustle service tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the test
testMyHustleServices();
