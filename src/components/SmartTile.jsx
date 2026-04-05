import { useMemo, useCallback, useState } from 'react'
import { TextLayoutEngine } from '../utils/TextLayoutEngine'

/**
 * SmartTile - Self-measuring tile component using Pretext
 * 
 * Calculates exact height needed for content before rendering,
 * eliminating layout shifts and reflow cycles.
 */

// Font configurations matching the design system
const TILE_FONTS = {
  title: '600 14px system-ui, -apple-system, sans-serif',
  description: '400 12px system-ui, -apple-system, sans-serif',
  tag: '500 10px system-ui, -apple-system, sans-serif',
  newBadge: '700 10px system-ui, -apple-system, sans-serif'
}

const LINE_HEIGHTS = {
  title: 19.6,    // 14px * 1.4
  description: 16.8, // 12px * 1.4
  tag: 14         // 10px * 1.4
}

// Padding and spacing constants
const SPACING = {
  padding: 12,
  gap: 8,
  buttonHeight: 28,
  newBadgeHeight: 16,
  tagHeight: 20,
  tagGap: 4
}

/**
 * Calculate exact metrics for a tile without any DOM measurement
 */
export function calculateSmartTileMetrics(
  name,
  description,
  tags,
  width,
  maxDescriptionLines,
  isExpanded
) {
  const contentWidth = width - (SPACING.padding * 2)
  
  // Measure title with truncation
  const titleResult = TextLayoutEngine.measureWithTruncation(
    name,
    TILE_FONTS.title,
    contentWidth,
    '...',
    { whiteSpace: 'normal' }
  )
  const titleHeight = LINE_HEIGHTS.title

  // Calculate description metrics
  const descText = description || `No description available for ${name}`
  const descClamp = TextLayoutEngine.calculateLineClamp(
    descText,
    TILE_FONTS.description,
    contentWidth,
    LINE_HEIGHTS.description,
    isExpanded ? 100 : maxDescriptionLines,
    { whiteSpace: 'normal' }
  )
  
  const descriptionHeight = isExpanded 
    ? TextLayoutEngine.measureHeight(descText, TILE_FONTS.description, contentWidth, LINE_HEIGHTS.description)
    : descClamp.height

  // Calculate tag section height
  let tagSectionHeight = 0
  let visibleTags = []
  
  if (tags && tags.length > 0 && isExpanded) {
    const maxTagWidth = contentWidth - 40 // Leave room for "+N more"
    let currentRowWidth = 0
    let rowCount = 1
    const maxTagsPerRow = Math.floor(contentWidth / 60) // Approximate tag width
    
    for (let i = 0; i < Math.min(tags.length, 12); i++) {
      const tagWidth = TextLayoutEngine.measureNaturalWidth(tags[i], TILE_FONTS.tag) + 12 // padding
      
      if (currentRowWidth + tagWidth > contentWidth && i > 0) {
        rowCount++
        currentRowWidth = tagWidth
      } else {
        currentRowWidth += tagWidth + SPACING.tagGap
      }
      
      visibleTags.push(tags[i])
    }
    
    tagSectionHeight = rowCount * (SPACING.tagHeight + SPACING.tagGap) + 20 // label space
  }

  // Calculate total height
  const newBadgeHeight = isNewArticle ? SPACING.newBadgeHeight + 4 : 0
  const contentHeight = (
    newBadgeHeight +
    titleHeight +
    SPACING.gap +
    descriptionHeight +
    SPACING.gap +
    SPACING.buttonHeight
  )
  
  const totalHeight = contentHeight + 
    (SPACING.padding * 2) + 
    (isExpanded ? tagSectionHeight + SPACING.padding : 0)

  return {
    totalHeight,
    contentHeight,
    descriptionHeight,
    titleHeight,
    tagSectionHeight,
    isDescriptionClamped: descClamp.wasClamped && !isExpanded,
    visibleDescription: isExpanded ? descText : descClamp.visibleText,
    visibleTags,
    truncatedTitle: titleResult.text,
    isTitleTruncated: titleResult.truncated
  }
}

/**
 * React hook for reactive tile metrics
 */
export function useSmartTileMetrics(
  name,
  description,
  tags,
  width,
  maxDescriptionLines = 2,
  isExpanded = false,
  isNewArticle = false
) {
  return useMemo(() => {
    const metrics = calculateSmartTileMetrics(
      name,
      description,
      tags,
      width,
      maxDescriptionLines,
      isExpanded
    )
    
    return {
      ...metrics,
      newBadgeHeight: isNewArticle ? SPACING.newBadgeHeight + 4 : 0
    }
  }, [name, description, tags, width, maxDescriptionLines, isExpanded, isNewArticle])
}

/**
 * SmartTile Component
 * 
 * A self-optimizing tile that pre-calculates its exact dimensions
 * using Pretext, eliminating layout shift and improving render performance.
 */
export function SmartTile({
  id,
  name,
  description,
  tags,
  isNewArticle,
  external_link,
  width,
  maxDescriptionLines = 2,
  isExpanded = false,
  isBookmarked = false,
  onExpand,
  onBookmark,
  onOpen,
  style,
  className
}) {
  const metrics = useSmartTileMetrics(
    name,
    description,
    tags,
    width,
    maxDescriptionLines,
    isExpanded,
    isNewArticle
  )
  
  // Touch state for active feedback
  const [isPressed, setIsPressed] = useState(false)

  const handleExpand = useCallback((e) => {
    // Provide haptic feedback on touch devices
    if (navigator.vibrate && e?.type?.includes('touch')) {
      navigator.vibrate(10)
    }
    onExpand?.()
  }, [onExpand])

  const handleBookmark = useCallback((e) => {
    e.stopPropagation()
    // Provide haptic feedback on touch devices
    if (navigator.vibrate && e?.type?.includes('touch')) {
      navigator.vibrate(10)
    }
    onBookmark?.()
  }, [onBookmark])

  const handleOpen = useCallback((e) => {
    e.stopPropagation()
    // Provide haptic feedback on touch devices
    if (navigator.vibrate && e?.type?.includes('touch')) {
      navigator.vibrate(10)
    }
    if (external_link) {
      window.open(external_link, '_blank', 'noopener,noreferrer')
    }
    onOpen?.()
  }, [external_link, onOpen])

  const background = isNewArticle
    ? 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(16,185,129,0.08))'
    : 'rgba(15, 23, 42, 0.8)'
  
  const borderColor = isNewArticle
    ? '1px solid rgba(34,211,238,0.5)'
    : '1px solid rgba(148, 163, 184, 0.3)'

  return (
    <div
      className={className}
      style={{
        width,
        height: metrics.totalHeight,
        padding: SPACING.padding,
        background,
        border: borderColor,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'height 0.2s ease-out, transform 0.1s ease, box-shadow 0.15s ease',
        transform: isPressed ? 'scale(0.98)' : 'scale(1)',
        boxShadow: isPressed ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
        touchAction: 'pan-y pinch-zoom',
        ...style
      }}
      onClick={handleExpand}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {/* New Article Badge */}
      {isNewArticle && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#06b6d4',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 4,
            opacity: 0.9,
            height: SPACING.newBadgeHeight
          }}
        >
          New Article
        </div>
      )}

      {/* Title */}
      <h4
        style={{
          margin: 0,
          color: '#f7f9ff',
          fontSize: 14,
          fontWeight: 600,
          lineHeight: `${LINE_HEIGHTS.title}px`,
          height: metrics.titleHeight,
          overflow: 'hidden',
          textOverflow: metrics.isTitleTruncated ? 'ellipsis' : undefined,
          whiteSpace: metrics.isTitleTruncated ? 'nowrap' : undefined,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
        title={metrics.isTitleTruncated ? name : undefined}
      >
        {metrics.truncatedTitle}
      </h4>

      {/* Gap */}
      <div style={{ height: SPACING.gap }} />

      {/* Description */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <p
          style={{
            color: '#94a3b8',
            fontSize: 12,
            margin: 0,
            lineHeight: `${LINE_HEIGHTS.description}px`,
            height: metrics.descriptionHeight,
            overflow: isExpanded ? 'auto' : 'hidden',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            ...(!isExpanded && {
              display: '-webkit-box',
              WebkitLineClamp: maxDescriptionLines,
              WebkitBoxOrient: 'vertical',
              textOverflow: 'ellipsis'
            })
          }}
        >
          {metrics.visibleDescription}
        </p>
        
        {/* Description loading indicator */}
        {!description && (
          <div
            style={{
              fontSize: 10,
              color: '#f59e0b',
              marginTop: 4,
              fontStyle: 'italic'
            }}
          >
            Loading description...
          </div>
        )}
      </div>

      {/* Gap */}
      <div style={{ height: SPACING.gap }} />

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleExpand(e)
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.transform = 'scale(0.96)'
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
          style={{
            flex: 1,
            padding: '10px 14px',
            minHeight: '44px',
            background: isNewArticle ? '#06b6d4' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            height: SPACING.buttonHeight,
            transition: 'transform 0.1s ease, background-color 0.2s',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            touchAction: 'manipulation',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isExpanded ? 'Fold' : 'Expand'}
        </button>

        {isNewArticle && external_link ? (
          <button
            onClick={handleOpen}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.96)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
            style={{
              flex: 1,
              padding: '10px 14px',
              minHeight: '44px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
              height: SPACING.buttonHeight,
              transition: 'transform 0.1s ease, background-color 0.2s',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              touchAction: 'manipulation',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Open
          </button>
        ) : (
          <button
            onClick={handleBookmark}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.96)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
            style={{
              flex: 1,
              padding: '10px 14px',
              minHeight: '44px',
              background: isBookmarked ? '#10b981' : '#374151',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
              height: SPACING.buttonHeight,
              transition: 'transform 0.1s ease, background-color 0.2s',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              touchAction: 'manipulation',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
        )}
      </div>

      {/* Expanded Tags Section */}
      {isExpanded && tags && tags.length > 0 && (
        <div
          style={{
            marginTop: SPACING.padding,
            paddingTop: SPACING.padding,
            borderTop: isNewArticle
              ? '1px solid rgba(34,211,238,0.3)'
              : '1px solid rgba(148, 163, 184, 0.2)'
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#64748b',
              marginBottom: 4,
              fontWeight: 600,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            {isNewArticle ? 'Article tags:' : 'Tags:'}
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.tagGap }}>
            {metrics.visibleTags.map(tag => (
              <span
                key={tag}
                style={{
                  background: isNewArticle
                    ? 'rgba(34,211,238,0.2)'
                    : 'rgba(59, 130, 246, 0.2)',
                  color: isNewArticle ? '#06b6d4' : '#60a5fa',
                  padding: '3px 6px',
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  border: isNewArticle
                    ? '1px solid rgba(34,211,238,0.3)'
                    : '1px solid rgba(59, 130, 246, 0.3)',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                {tag}
              </span>
            ))}
            {tags.length > metrics.visibleTags.length && (
              <span
                style={{
                  fontSize: 9,
                  color: '#94a3b8',
                  fontStyle: 'italic',
                  padding: '3px 0'
                }}
              >
                +{tags.length - metrics.visibleTags.length} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Batch calculate metrics for multiple tiles (useful for grid layouts)
 */
export function batchCalculateTileMetrics(
  items,
  width,
  maxDescriptionLines = 2
) {
  const startTime = performance.now()
  const results = new Map()

  for (const item of items) {
    const metrics = calculateSmartTileMetrics(
      item.name,
      item.description,
      item.tags,
      width,
      maxDescriptionLines,
      false
    )
    results.set(item.id, { ...metrics, isNewArticle: item.isNewArticle || false })
  }

  console.log(`[SmartTile] Batch calculated ${items.length} tiles in ${(performance.now() - startTime).toFixed(2)}ms`)
  
  return results
}

export default SmartTile
