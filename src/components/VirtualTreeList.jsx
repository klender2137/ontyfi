import { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import { TextLayoutEngine } from '../utils/TextLayoutEngine'

/**
 * VirtualTreeList - High-performance virtual scrolling for tree nodes
 * 
 * Uses Pretext to calculate exact item heights before rendering,
 * enabling smooth scrolling of 10,000+ items with ~4ms layout calculation.
 */

const DEFAULT_ESTIMATED_HEIGHT = 200
const OVERSCAN_COUNT = 3
const SCROLL_THROTTLE_MS = 16 // ~60fps

// Pre-computed font metrics for consistent measurement
const TILE_TITLE_FONT = '600 14px system-ui, -apple-system, sans-serif'
const TILE_DESC_FONT = '400 12px system-ui, -apple-system, sans-serif'
const TILE_LINE_HEIGHT = 1.4

export function useVirtualTreeMetrics(items, itemWidth, baseHeight) {
  return useMemo(() => {
    if (items.length === 0) {
      return {
        measuredItems: [],
        totalHeight: 0,
        averageHeight: baseHeight,
        isMeasured: true
      }
    }

    // Batch prepare all text for efficient measurement
    const itemsWithText = items.map(item => ({
      id: item.id,
      text: item.description || `No description available for ${item.name}`
    }))

    // Measure all descriptions in one batch
    const startTime = performance.now()
    const descMeasurements = TextLayoutEngine.batchMeasure(
      itemsWithText,
      TILE_DESC_FONT,
      itemWidth - 24, // padding
      16.8, // 12px * 1.4 line-height
      { whiteSpace: 'normal' }
    )

    // Measure all titles (usually single line, but measure anyway)
    const titleItems = items.map(item => ({ id: item.id, text: item.name }))
    const titleMeasurements = TextLayoutEngine.batchMeasure(
      titleItems,
      TILE_TITLE_FONT,
      itemWidth - 24,
      19.6, // 14px * 1.4
      { whiteSpace: 'normal' }
    )

    let totalOffset = 0
    const measuredItems = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const titleHeight = Math.min(titleMeasurements.measurements.get(item.id)?.height || 19.6, 19.6)
      const descMeasurement = descMeasurements.measurements.get(item.id)
      
      // Clamp description to 2 lines max for preview
      const descHeight = descMeasurement 
        ? Math.min(descMeasurement.height, 16.8 * 2) 
        : 33.6

      // Base height + title + description + padding + action buttons
      const height = baseHeight + titleHeight + descHeight + 60

      measuredItems.push({
        item,
        index: i,
        offset: totalOffset,
        height,
        titleHeight,
        descHeight
      })

      totalOffset += height
    }

    const totalTime = performance.now() - startTime
    console.log(`[VirtualTreeList] Measured ${items.length} items in ${totalTime.toFixed(2)}ms`)

    return {
      measuredItems,
      totalHeight: totalOffset,
      averageHeight: totalOffset / items.length,
      isMeasured: true
    }
  }, [items, itemWidth, baseHeight])
}

export function useVirtualScroll(
  measuredItems,
  totalHeight,
  containerHeight,
  overscan = OVERSCAN_COUNT
) {
  const [scrollTop, setScrollTop] = useState(0)
  const lastScrollTime = useRef(0)
  const rafId = useRef(null)

  const visibleRange = useMemo(() => {
    if (measuredItems.length === 0) return { start: 0, end: 0 }

    // Binary search to find start index
    let startIdx = 0
    let endIdx = measuredItems.length - 1
    
    while (startIdx <= endIdx) {
      const mid = Math.floor((startIdx + endIdx) / 2)
      if (measuredItems[mid].offset < scrollTop) {
        startIdx = mid + 1
      } else {
        endIdx = mid - 1
      }
    }
    
    const start = Math.max(0, startIdx - 1 - overscan)

    // Find end index
    const scrollBottom = scrollTop + containerHeight
    endIdx = startIdx
    while (endIdx < measuredItems.length && measuredItems[endIdx].offset < scrollBottom) {
      endIdx++
    }
    
    const end = Math.min(measuredItems.length, endIdx + overscan)

    return { start, end }
  }, [measuredItems, scrollTop, containerHeight, overscan])

  const handleScroll = useCallback((e) => {
    const now = performance.now()
    const target = e.target
    const newScrollTop = target.scrollTop

    // Throttle using RAF for smooth 60fps
    if (now - lastScrollTime.current < SCROLL_THROTTLE_MS) {
      if (rafId.current) cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        setScrollTop(newScrollTop)
      })
      return
    }

    lastScrollTime.current = now
    setScrollTop(newScrollTop)
  }, [])

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return {
    scrollTop,
    visibleRange,
    handleScroll
  }
}

/**
 * VirtualTreeList Component
 * 
 * Renders only visible items for massive performance gains.
 * Calculates exact positions using Pretext before any DOM rendering.
 */
export function VirtualTreeList({
  items,
  renderItem,
  containerHeight,
  itemWidth,
  baseItemHeight = DEFAULT_ESTIMATED_HEIGHT,
  headerHeight = 0,
  gap = 16,
  overscan = OVERSCAN_COUNT,
  onVisibleRangeChange,
  className,
  style
}) {
  const { measuredItems, totalHeight, averageHeight, isMeasured } = useVirtualTreeMetrics(
    items,
    itemWidth,
    baseItemHeight
  )

  const { scrollTop, visibleRange, handleScroll } = useVirtualScroll(
    measuredItems,
    totalHeight,
    containerHeight,
    overscan
  )

  // Notify parent of visible range changes
  useEffect(() => {
    onVisibleRangeChange?.(visibleRange.start, visibleRange.end)
  }, [visibleRange, onVisibleRangeChange])

  const visibleItems = useMemo(() => {
    return measuredItems.slice(visibleRange.start, visibleRange.end)
  }, [measuredItems, visibleRange])

  // Track expanded/bookmarked state (simplified - parent should manage)
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set())

  const toggleExpand = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleBookmark = useCallback((id) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (!isMeasured) {
    return (
      <div 
        className={className}
        style={{
          height: containerHeight,
          overflow: 'auto',
          ...style
        }}
      >
        <div style={{ height: items.length * averageHeight }} />
      </div>
    )
  }

  return (
    <div
      className={className}
      onScroll={handleScroll}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
        ...style
      }}
    >
      <div style={{ height: headerHeight }} />
      
      {/* Spacer for total scrollable height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, offset, height }) => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              top: offset,
              left: 0,
              right: 0,
              height,
              paddingBottom: gap
            }}
          >
            {renderItem({
              item,
              index,
              style: { height: height - gap },
              isExpanded: expandedIds.has(item.id),
              onExpand: () => toggleExpand(item.id),
              onBookmark: () => toggleBookmark(item.id),
              isBookmarked: bookmarkedIds.has(item.id)
            })}
          </div>
        ))}
      </div>

      {/* Performance debug info (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'fixed',
            bottom: 8,
            right: 8,
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 9999
          }}
        >
          Items: {visibleRange.start}-{visibleRange.end} / {items.length}
          {' | '}
          Scroll: {scrollTop.toFixed(0)}px
          {' | '}
          Avg H: {averageHeight.toFixed(1)}px
        </div>
      )}
    </div>
  )
}

/**
 * Grid virtualization for TreeMap-style layouts
 * Computes exact positions for masonry-style or CSS grid layouts
 */
export function useVirtualGrid(
  items,
  containerWidth,
  minColumnWidth,
  gap,
  getItemHeight
) {
  return useMemo(() => {
    // Calculate optimal columns
    const { columnCount, columnWidth } = TextLayoutEngine.computeOptimalColumns(
      items.map(i => ({ id: i.id, text: i.name })),
      TILE_TITLE_FONT,
      containerWidth,
      minColumnWidth,
      gap
    )

    // Distribute items to columns using masonry layout
    const columnHeights = new Array(columnCount).fill(0)
    const itemPositions = items.map(item => {
      const shortestCol = columnHeights.indexOf(Math.min(...columnHeights))
      const height = getItemHeight(item)
      const top = columnHeights[shortestCol]
      const left = shortestCol * (columnWidth + gap)

      columnHeights[shortestCol] += height + gap

      return {
        item,
        top,
        left,
        width: columnWidth,
        height,
        column: shortestCol
      }
    })

    const maxHeight = Math.max(...columnHeights)

    return {
      columnCount,
      columnWidth,
      itemPositions,
      totalHeight: maxHeight
    }
  }, [items, containerWidth, minColumnWidth, gap, getItemHeight])
}

export default VirtualTreeList
