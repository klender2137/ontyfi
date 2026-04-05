import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { TextLayoutEngine } from '../utils/TextLayoutEngine'

/**
 * EnhancedTicker - Collision-aware animated ticker using Pretext
 * 
 * Uses exact text width measurements to prevent ticker overlap
 * and create smooth, collision-free animations.
 */

const TICKER_FONT = 'bold 14px monospace'
const LINE_HEIGHT = 20
const DEFAULT_SPEED = 20 // seconds for full traversal
const MIN_SPACING = 50 // minimum pixels between tickers

/**
 * Calculate ticker positions with collision detection
 */
export function calculateTickerPositions(
  tickers,
  containerWidth,
  containerHeight,
  speeds
) {
  const startTime = performance.now()
  
  // Measure all ticker widths
  const measurements = TextLayoutEngine.batchMeasure(
    tickers.map((t, i) => ({ 
      id: `ticker-${i}`, 
      text: `${t.symbol}: $${t.price.toFixed(2)} (${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%)`
    })),
    TICKER_FONT,
    containerWidth,
    LINE_HEIGHT
  )

  // Track occupied positions at different Y levels
  const yLevels = new Map() // y position -> array of {start, end, timeOffset}
  const positions = []

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]
    const text = `${ticker.symbol}: $${ticker.price.toFixed(2)} (${ticker.change >= 0 ? '+' : ''}${ticker.change.toFixed(2)}%)`
    const width = measurements.measurements.get(`ticker-${i}`)?.width || 200
    const speed = speeds?.[i] || (DEFAULT_SPEED + (i * 5))
    
    // Find a Y level with minimal collisions
    let bestY = 0
    let minCollisions = Infinity
    const maxY = Math.floor(containerHeight / LINE_HEIGHT) * LINE_HEIGHT
    
    for (let y = 0; y <= maxY; y += LINE_HEIGHT) {
      const existing = yLevels.get(y) || []
      let collisions = 0
      
      // Check for potential collisions
      for (const occupied of existing) {
        // Simple collision check: same direction, overlapping time windows
        const timeSpan = width / (containerWidth / speed)
        if (Math.abs(occupied.timeOffset % speed - (i * 2) % speed) < timeSpan) {
          collisions++
        }
      }
      
      if (collisions < minCollisions) {
        minCollisions = collisions
        bestY = y
        
        if (collisions === 0) break // Found a clear spot
      }
    }

    // Add to tracking
    const existing = yLevels.get(bestY) || []
    existing.push({
      start: -width,
      end: containerWidth,
      timeOffset: i * 2, // stagger start times
      speed
    })
    yLevels.set(bestY, existing)

    positions.push({
      ticker,
      index: i,
      text,
      width,
      y: bestY,
      speed,
      color: ticker.change >= 0 ? '#4ade80' : '#f87171',
      startLeft: -width - MIN_SPACING
    })
  }

  console.log(`[EnhancedTicker] Calculated ${tickers.length} positions in ${(performance.now() - startTime).toFixed(2)}ms`)

  return positions
}

/**
 * React hook for collision-aware ticker positioning
 */
export function useTickerPositions(
  tickers,
  containerWidth,
  containerHeight,
  speeds
) {
  return useMemo(() => {
    if (!tickers?.length || !containerWidth || !containerHeight) {
      return []
    }
    return calculateTickerPositions(tickers, containerWidth, containerHeight, speeds)
  }, [tickers, containerWidth, containerHeight, speeds])
}

/**
 * Enhanced Ticker Component with collision detection
 */
export function EnhancedTicker({
  tickers,
  containerWidth,
  containerHeight,
  speeds,
  className,
  style
}) {
  const positions = useTickerPositions(tickers, containerWidth, containerHeight, speeds)
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef(null)

  // Touch handlers for pause/play
  const handleTouchStart = useCallback(() => setIsPaused(true), [])
  const handleTouchEnd = useCallback(() => setIsPaused(false), [])

  // Pause animation on hover or touch
  const handleMouseEnter = useCallback(() => setIsPaused(true), [])
  const handleMouseLeave = useCallback(() => setIsPaused(false), [])

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: containerWidth,
        height: containerHeight,
        overflow: 'hidden',
        pointerEvents: 'auto',
        touchAction: 'pan-y',
        ...style
      }}
    >
      {positions.map(({ ticker, index, text, width, y, speed, color, startLeft }) => (
        <div
          key={ticker.symbol}
          style={{
            position: 'absolute',
            color,
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            top: y,
            left: startLeft,
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(0,0,0,0.5)',
            animation: isPaused ? 'none' : `ticker-commute-${index} ${speed}s linear infinite`,
            animationDelay: `${index * 2}s`
          }}
        >
          {text}
        </div>
      ))}

      {/* Inject keyframe animations */}
      <style>{`
        ${positions.map(({ index, startLeft }, i) => `
          @keyframes ticker-commute-${index} {
            from { 
              transform: translateX(0); 
            }
            to { 
              transform: translateX(calc(100vw + ${Math.abs(startLeft)}px + 400px)); 
            }
          }
        `).join('\n')}
      `}</style>

      {/* Performance debug overlay (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 10,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 9999
          }}
        >
          Tickers: {positions.length} | Paused: {isPaused ? 'yes' : 'no'}
        </div>
      )}
    </div>
  )
}

/**
 * Self-contained ticker overlay component
 * Handles container measurement automatically
 */
export function TickerOverlay({
  tickers,
  speeds,
  className,
  style
}) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef(null)

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width,
          height: rect.height
        })
      }
    }

    measure()

    const resizeObserver = new ResizeObserver(measure)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    window.addEventListener('resize', measure)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        opacity: 0.4,
        overflow: 'hidden',
        ...style
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <EnhancedTicker
          tickers={tickers}
          containerWidth={dimensions.width}
          containerHeight={dimensions.height}
          speeds={speeds}
        />
      )}
    </div>
  )
}

export default EnhancedTicker
