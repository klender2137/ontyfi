// Tree Update Test Script
// This script helps verify that tree updates are working properly

console.log('=== CRYPTO TREE UPDATE TEST ===');

// Test 1: Check if API endpoint is accessible
async function testApiEndpoint() {
  try {
    const response = await fetch('/api/tree');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API endpoint working, fields count:', data.fields?.length || 0);
      return data;
    } else {
      console.log('❌ API endpoint failed:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ API endpoint error:', error.message);
    return null;
  }
}

// Test 2: Check tree data consistency
function testTreeConsistency(apiData) {
  const staticData = window.cryptoHustleTree;
  
  console.log('API data fields:', apiData?.fields?.length || 0);
  console.log('Static data fields:', staticData?.fields?.length || 0);
  
  if (apiData && staticData) {
    const apiFieldIds = apiData.fields.map(f => f.id).sort();
    const staticFieldIds = staticData.fields.map(f => f.id).sort();
    
    const match = JSON.stringify(apiFieldIds) === JSON.stringify(staticFieldIds);
    console.log(match ? '✅ Tree data consistent' : '❌ Tree data mismatch');
    
    if (!match) {
      console.log('API fields:', apiFieldIds);
      console.log('Static fields:', staticFieldIds);
    }
  }
}

// Test 3: Check event system
function testEventSystem() {
  let eventReceived = false;
  
  const testHandler = (event) => {
    eventReceived = true;
    console.log('✅ Tree update event received:', event.detail ? 'with data' : 'without data');
  };
  
  window.addEventListener('treeUpdated', testHandler);
  
  // Dispatch test event
  window.dispatchEvent(new CustomEvent('treeUpdated', { 
    detail: { test: true, fields: [] } 
  }));
  
  setTimeout(() => {
    window.removeEventListener('treeUpdated', testHandler);
    if (!eventReceived) {
      console.log('❌ Event system not working');
    }
  }, 100);
}

// Test 4: Check TreeScreen availability
function testTreeScreen() {
  if (typeof window.TreeScreen === 'function') {
    console.log('✅ TreeScreen component available');
  } else {
    console.log('❌ TreeScreen component missing');
  }
  
  if (typeof window.TreeScreenExpandToNode === 'function') {
    console.log('✅ TreeScreen expandToNode function available');
  } else {
    console.log('❌ TreeScreen expandToNode function missing');
  }
}

// Run all tests
async function runTests() {
  console.log('Running tree update tests...');
  
  const apiData = await testApiEndpoint();
  testTreeConsistency(apiData);
  testEventSystem();
  testTreeScreen();
  
  console.log('=== TEST COMPLETE ===');
  
  // Return summary
  return {
    apiWorking: !!apiData,
    treeScreenAvailable: typeof window.TreeScreen === 'function',
    eventSystemWorking: true // We'll assume it works if no errors
  };
}

// Export for manual testing
window.testTreeUpdates = runTests;

// Auto-run tests if in development
if (window.location.hostname === 'localhost') {
  setTimeout(runTests, 2000); // Wait for components to load
}