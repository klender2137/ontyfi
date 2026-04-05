import { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import { TextLayoutEngine } from '../utils/TextLayoutEngine'

/**
 * OptimalGrid - Intelligent grid layout using Pretext measurements
 * 
 * Computes optimal column count and item positions based on actual
 * content widths, eliminating layout thrashing and reflow cycles.
 */

// Default font configurations
const GRID_FONTS = {
  title: '600 16px system-ui, -apple-system, sans-serif',
  subtitle: '400 13px system-ui, -apple-system, sans-serif'
}

const LINE_HEIGHTS = {
  title: 22.4,   // 16px * 1.4
  subtitle: 18.2 // 13px * 1.4
}

const DEFAULTS = {
  minColumnWidth: 280,
  gap: 24,
  maxColumns: 6,
  baseItemHeight: 80,
  padding: 20
}

/**
 * Calculate optimal grid layout based on content measurements
 */
export function calculateOptimalGrid(
  items,
  containerWidth,
  options
) {
  const {
    minColumnWidth = DEFAULTS.minColumnWidth,
    gap = DEFAULTS.gap,
    maxColumns = DEFAULTS.maxColumns,
    baseItemHeight = DEFAULTS.baseItemHeight,
    getItemHeight
  } = options || {}

  if (items.length === 0) {
    return {
      positions: [],
      layout: { columnCount: 1, columnWidth: minColumnWidth, gap, containerWidth },
      totalHeight: 0,
      rowCount: 0
    }
  }

  // Measure all titles to find the widest content
  const measurements = TextLayoutEngine.batchMeasure(
    items.map(i => ({ id: i.id, text: i.title })),
    GRID_FONTS.title,
    containerWidth,
    LINE_HEIGHTS.title
  )

  // Find max content width considering both title and subtitle
  let maxContentWidth = minColumnWidth
  for (const item of items) {
    const titleWidth = measurements.measurements.get(item.id)?.width || 0
    const subtitleWidth = item.subtitle 
      ? TextLayoutEngine.measureNaturalWidth(item.subtitle, GRID_FONTS.subtitle)
      : 0
    const itemMaxWidth = Math.max(titleWidth, subtitleWidth) + (DEFAULTS.padding * 2)
    if (itemMaxWidth > maxContentWidth) {
      maxContentWidth = itemMaxWidth
    }
  }

  // Calculate optimal column count
  const availableWidth = containerWidth + gap
  const effectiveColumnWidth = Math.min(
    Math.max(minColumnWidth, maxContentWidth),
    containerWidth * 0.5 // Never exceed 50% of container
  )
  
  let columnCount = Math.floor(availableWidth / (effectiveColumnWidth + gap))
  columnCount = Math.max(1, Math.min(columnCount, maxColumns))
  
  const columnWidth = (containerWidth - (columnCount - 1) * gap) / columnCount

  // Position items in grid
  const positions = []
  let rowCount = 0

  for (let i = 0; i < items.length; i++) {
    const row = Math.floor(i / columnCount)
    const col = i % columnCount
    
    const itemHeight = getItemHeight 
      ? getItemHeight(items[i], columnWidth)
      : baseItemHeight

    positions.push({
      item: items[i],
      index: i,
      row,
      column: col,
      x: col * (columnWidth + gap),
      y: row * (itemHeight + gap),
      width: columnWidth,
      height: itemHeight
    })

    if (row > rowCount) rowCount = row
  }

  rowCount++ // Convert from 0-indexed to count

  // Calculate total height
  const maxY = positions.length > 0 
    ? Math.max(...positions.map(p => p.y + p.height))
    : 0

  return {
    positions,
    layout: {
      columnCount,
      columnWidth,
      gap,
      containerWidth
    },
    totalHeight: maxY,
    rowCount
  }
}

/**
 * React hook for responsive optimal grid
 */
export function useOptimalGrid(
  items,
  containerRef,
  options
) {
  const [containerWidth, setContainerWidth] = useState(1200)
  const [isMeasured, setIsMeasured] = useState(false)

  // Measure container width
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.getBoundingClientRect().width
        setContainerWidth(width)
        setIsMeasured(true)
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
  }, [containerRef])

  // Calculate grid metrics
  const metrics = useMemo(() => {
    if (!isMeasured) {
      return {
        positions: [],
        layout: {
          columnCount: 1,
          columnWidth: options?.minColumnWidth || DEFAULTS.minColumnWidth,
          gap: options?.gap || DEFAULTS.gap,
          containerWidth
        },
        totalHeight: items.length * (options?.baseItemHeight || DEFAULTS.baseItemHeight),
        rowCount: items.length
      }
    }

    return calculateOptimalGrid(items, containerWidth, options)
  }, [items, containerWidth, isMeasured, options])

  return {
    ...metrics,
    containerWidth,
    isMeasured
  }
}

/**
 * OptimalGrid Component
 * 
 * Renders children in an optimally-calculated grid layout.
 */
export function OptimalGrid({
  items,
  renderItem,
  containerWidth,
  minColumnWidth = DEFAULTS.minColumnWidth,
  gap = DEFAULTS.gap,
  maxColumns = DEFAULTS.maxColumns,
  baseItemHeight = DEFAULTS.baseItemHeight,
  getItemHeight,
  className,
  style
}) {
  const metrics = useMemo(() => {
    return calculateOptimalGrid(items, containerWidth, {
      minColumnWidth,
      gap,
      maxColumns,
      baseItemHeight,
      getItemHeight
    })
  }, [items, containerWidth, minColumnWidth, gap, maxColumns, baseItemHeight, getItemHeight])

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height: metrics.totalHeight,
        ...style
      }}
    >
      {metrics.positions.map(position => (
        <div
          key={position.item.id}
          style={{
            position: 'absolute',
            left: position.x,
            top: position.y,
            width: position.width,
            height: position.height,
            boxSizing: 'border-box'
          }}
        >
          {renderItem({
            item: position.item,
            position,
            style: {
              width: '100%',
              height: '100%'
            }
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * ResponsiveOptimalGrid - Self-measuring grid that responds to container size
 */
export function ResponsiveOptimalGrid({
  containerRef,
  ...props
}) {
  const internalRef = useRef(null)
  const effectiveRef = containerRef || internalRef
  
  const { positions, layout, totalHeight, isMeasured } = useOptimalGrid(
    props.items,
    effectiveRef,
    {
      minColumnWidth: props.minColumnWidth,
      gap: props.gap,
      maxColumns: props.maxColumns,
      baseItemHeight: props.baseItemHeight,
      getItemHeight: props.getItemHeight
    }
  )

  // Create metrics object matching calculateOptimalGrid output
  const metrics = {
    positions,
    layout,
    totalHeight,
    rowCount: Math.ceil(props.items.length / layout.columnCount)
  }

  if (!isMeasured) {
    return (
      <div
        ref={internalRef}
        className={props.className}
        style={{
          position: 'relative',
          height: props.items.length * (props.baseItemHeight || DEFAULTS.baseItemHeight),
          ...props.style
        }}
      >
        {/* Placeholder rendering while measuring */}
      </div>
    )
  }

  return (
    <div
      ref={internalRef}
      className={props.className}
      style={{
        position: 'relative',
        height: metrics.totalHeight,
        ...props.style
      }}
    >
      {metrics.positions.map(position => (
        <div
          key={position.item.id}
          style={{
            position: 'absolute',
            left: position.x,
            top: position.y,
            width: position.width,
            height: position.height,
            boxSizing: 'border-box'
          }}
        >
          {props.renderItem({
            item: position.item,
            position,
            style: {
              width: '100%',
              height: '100%'
            }
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * Masonry-style layout using Pretext measurements
 * Positions items in columns based on their actual heights
 */
export function calculateMasonryLayout(
  items,
  columnCount,
  columnWidth,
  gap,
  getItemHeight
) {
  const columnHeights = new Array(columnCount).fill(0)
  
  return items.map((item, index) => {
    const shortestCol = columnHeights.indexOf(Math.min(...columnHeights))
    const height = getItemHeight(item)
    const y = columnHeights[shortestCol]
    const x = shortestCol * (columnWidth + gap)

    columnHeights[shortestCol] += height + gap

    return {
      item,
      index,
      x,
      y,
      width: columnWidth,
      height
    }
  })
}

/**
 * Batch compute heights for masonry layout
 */
export function batchComputeHeights(
  items,
  width,
  baseHeight = 100
) {
  const startTime = performance.now()
  const heights = new Map()

  const titleMeasurements = TextLayoutEngine.batchMeasure(
    items.map(i => ({ id: i.id, text: i.title })),
    GRID_FONTS.title,
    width - 40,
    LINE_HEIGHTS.title
  )

  for (const item of items) {
    const titleHeight = titleMeasurements.measurements.get(item.id)?.height || LINE_HEIGHTS.title
    let descHeight = 0
    
    if (item.description) {
      descHeight = TextLayoutEngine.measureHeight(
        item.description,
        GRID_FONTS.subtitle,
        width - 40,
        LINE_HEIGHTS.subtitle
      )
    }

    heights.set(item.id, baseHeight + titleHeight + descHeight)
  }

  console.log(`[OptimalGrid] Batch computed ${items.length} heights in ${(performance.now() - startTime).toFixed(2)}ms`)

  return heights
}

export default OptimalGrid
