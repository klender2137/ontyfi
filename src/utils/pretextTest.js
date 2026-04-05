/**
 * Pretext Integration Test
 * 
 * This file verifies that all Pretext optimizations are working correctly.
 * Run this in the browser console to test:
 * 
 * import('./src/utils/pretextTest.js').then(m => m.runTests())
 */

import { TextLayoutEngine } from './TextLayoutEngine'
import { calculateSmartTileMetrics, batchCalculateTileMetrics } from '../components/SmartTile'
import { calculateOptimalGrid, batchComputeHeights } from '../components/OptimalGrid'
import { calculateTickerPositions } from '../components/EnhancedTicker'

export function runTests() {
  console.log('🧪 Running Pretext Integration Tests...\n')

  const results = []

  // Test 1: TextLayoutEngine basic measurement
  try {
    const start = performance.now()
    const height = TextLayoutEngine.measureHeight(
      'This is a test description for a tile component that might be quite long',
      '400 12px system-ui, sans-serif',
      280,
      16.8
    )
    const time = performance.now() - start
    results.push({ name: 'Basic Height Measurement', passed: height > 0 && time < 10, time })
  } catch (e) {
    results.push({ name: 'Basic Height Measurement', passed: false, error: e.message })
  }

  // Test 2: Batch measurement performance
  try {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      text: `Test description for item ${i} with some content that might wrap to multiple lines`
    }))
    
    const start = performance.now()
    const result = TextLayoutEngine.batchMeasure(
      items,
      '400 12px system-ui, sans-serif',
      280,
      16.8
    )
    const time = performance.now() - start
    
    results.push({ 
      name: 'Batch Measurement (1000 items)', 
      passed: result.measurements.size === 1000 && time < 100, 
      time 
    })
  } catch (e) {
    results.push({ name: 'Batch Measurement', passed: false, error: e.message })
  }

  // Test 3: SmartTile metrics calculation
  try {
    const start = performance.now()
    const metrics = calculateSmartTileMetrics(
      'Test Tile Name',
      'This is a test description that might need to be clamped',
      ['tag1', 'tag2', 'tag3'],
      300,
      2,
      false
    )
    const time = performance.now() - start
    
    results.push({ 
      name: 'SmartTile Metrics', 
      passed: metrics.totalHeight > 0 && metrics.visibleTags.length > 0, 
      time 
    })
  } catch (e) {
    results.push({ name: 'SmartTile Metrics', passed: false, error: e.message })
  }

  // Test 4: OptimalGrid calculation
  try {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `grid-${i}`,
      title: `Grid Item ${i}`,
      subtitle: i % 3 === 0 ? 'With subtitle text' : undefined
    }))
    
    const start = performance.now()
    const grid = calculateOptimalGrid(items, 1200, {
      minColumnWidth: 280,
      gap: 24
    })
    const time = performance.now() - start
    
    results.push({ 
      name: 'OptimalGrid Calculation', 
      passed: grid.positions.length === 20 && grid.columnCount >= 1, 
      time 
    })
  } catch (e) {
    results.push({ name: 'OptimalGrid', passed: false, error: e.message })
  }

  // Test 5: Ticker collision detection
  try {
    const tickers = Array.from({ length: 10 }, (_, i) => ({
      symbol: `TICK${i}`,
      price: 100 + Math.random() * 100,
      change: (Math.random() - 0.5) * 10
    }))
    
    const start = performance.now()
    const positions = calculateTickerPositions(tickers, 1920, 1080)
    const time = performance.now() - start
    
    results.push({ 
      name: 'Ticker Collision Detection', 
      passed: positions.length === 10 && positions.every(p => p.y >= 0), 
      time 
    })
  } catch (e) {
    results.push({ name: 'Ticker Positions', passed: false, error: e.message })
  }

  // Test 6: Cache stats
  try {
    const stats = TextLayoutEngine.getCacheStats()
    results.push({ 
      name: 'Cache Stats', 
      passed: typeof stats.preparedCacheSize === 'number', 
      info: stats 
    })
  } catch (e) {
    results.push({ name: 'Cache Stats', passed: false, error: e.message })
  }

  // Print results
  console.log('📊 Test Results:\n')
  let passed = 0
  let failed = 0
  
  for (const result of results) {
    const status = result.passed ? '✅' : '❌'
    const time = result.time ? `(${result.time.toFixed(2)}ms)` : ''
    console.log(`${status} ${result.name} ${time}`)
    
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    if (result.info) {
      console.log(`   Info:`, result.info)
    }
    
    if (result.passed) passed++
    else failed++
  }
  
  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed out of ${results.length} tests`)
  
  return { passed, failed, total: results.length, results }
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
  window.runPretextTests = runTests
  console.log('Pretext test suite loaded. Run runPretextTests() to execute.')
}

export default { runTests }
