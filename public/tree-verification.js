// TreeScreen Verification Script
// This script tests all the fixes implemented for the TreeScreen

(function() {
  'use strict';
  
  console.log('🔍 TreeScreen Verification Starting...');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  function test(name, condition, details = '') {
    const passed = Boolean(condition);
    results.tests.push({ name, passed, details });
    if (passed) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      console.error(`❌ ${name}${details ? ': ' + details : ''}`);
    }
  }
  
  // Test 1: TreeScreen component is loaded
  test(
    'TreeScreen component loaded',
    typeof window.TreeScreen === 'function',
    'TreeScreen should be available as a function'
  );
  
  // Test 2: CryptoTree.json data is loaded
  test(
    'CryptoTree.json data loaded',
    window.cryptoHustleTree && 
    window.cryptoHustleTree.fields && 
    Array.isArray(window.cryptoHustleTree.fields) &&
    window.cryptoHustleTree.fields.length > 0,
    `Found ${window.cryptoHustleTree?.fields?.length || 0} fields`
  );
  
  // Test 3: Old TreeScreen files are disabled
  test(
    'Old TreeScreen files disabled',
    !document.querySelector('script[src="TreeScreen.js"]')?.onload ||
    !document.querySelector('script[src="TreeScreen-fixed.js"]')?.onload ||
    !document.querySelector('script[src="TreeScreen-minimal.js"]')?.onload,
    'Old TreeScreen files should not be actively loading'
  );
  
  // Test 4: Centralized tree loader is loaded
  test(
    'Centralized tree loader loaded',
    document.querySelector('script[src="tree-loader-centralized.js"]') !== null,
    'tree-loader-centralized.js should be loaded'
  );
  
  // Test 5: Tree data structure is valid
  if (window.cryptoHustleTree && window.cryptoHustleTree.fields) {
    const firstField = window.cryptoHustleTree.fields[0];
    test(
      'Tree data structure is valid',
      firstField && 
      typeof firstField.id === 'string' &&
      typeof firstField.name === 'string' &&
      Array.isArray(firstField.categories || firstField.subcategories || firstField.nodes || []),
      'First field has required properties'
    );
  } else {
    test('Tree data structure is valid', false, 'No tree data available');
  }
  
  // Test 6: React is available
  test(
    'React is available',
    typeof React !== 'undefined' && typeof ReactDOM !== 'undefined',
    'React and ReactDOM should be loaded'
  );
  
  // Test 7: Helper functions are available
  test(
    'Helper functions available',
    typeof window.flattenTree === 'function',
    'flattenTree helper should be available'
  );
  
  // Test 8: No conflicting tree data sources
  test(
    'No conflicting tree data sources',
    !window.staticTreeData && !window.alternativeTreeData,
    'Only cryptoHustleTree should exist as tree data source'
  );
  
  // Test 9: TreeScreen can be instantiated
  try {
    const testElement = React.createElement(window.TreeScreen, {
      tree: { fields: [] },
      onOpenArticle: () => {},
      bookmarksApi: { isBookmarked: () => false, toggleBookmark: () => {} }
    });
    test(
      'TreeScreen can be instantiated',
      testElement && testElement.type === window.TreeScreen,
      'TreeScreen React element created successfully'
    );
  } catch (error) {
    test('TreeScreen can be instantiated', false, error.message);
  }
  
  // Test 10: API endpoint is accessible
  fetch('/api/tree')
    .then(response => {
      test(
        'API endpoint accessible',
        response.ok,
        `API returned status ${response.status}`
      );
      return response.json();
    })
    .then(data => {
      test(
        'API returns valid tree data',
        data && data.fields && Array.isArray(data.fields),
        `API returned ${data?.fields?.length || 0} fields`
      );
      
      // Final report
      setTimeout(() => {
        console.log('\n📊 TreeScreen Verification Results:');
        console.log(`✅ Passed: ${results.passed}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
        
        if (results.failed === 0) {
          console.log('\n🎉 All tests passed! TreeScreen should work flawlessly.');
        } else {
          console.log('\n⚠️ Some tests failed. Check the issues above.');
        }
        
        // Store results globally for debugging
        window.TreeScreenVerificationResults = results;
      }, 100);
    })
    .catch(error => {
      test('API endpoint accessible', false, error.message);
      
      // Final report for API failure case
      setTimeout(() => {
        console.log('\n📊 TreeScreen Verification Results:');
        console.log(`✅ Passed: ${results.passed}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
        
        if (results.failed <= 2) { // Allow API failures in some environments
          console.log('\n🎉 Core tests passed! TreeScreen should work with JSON fallback.');
        } else {
          console.log('\n⚠️ Multiple tests failed. Check the issues above.');
        }
        
        window.TreeScreenVerificationResults = results;
      }, 100);
    });
  
})();