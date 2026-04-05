import { prepare, prepareWithSegments, layout, walkLineRanges } from '@chenglou/pretext'

type WhiteSpaceMode = 'normal' | 'pre-wrap'

type PreparedEntry = {
  prepared: unknown
  lastUsed: number
}

type PreparedSegmentsEntry = {
  prepared: unknown
  lastUsed: number
}

type LineInfo = {
  width: number
  height: number
  top: number
  text: string
}

type ParagraphMeasurement = {
  width: number
  height: number
  lines: number
  lineDetails: LineInfo[]
}

type TextMeasurement = {
  text: string
  width: number
  height: number
  lines: number
}

type BatchMeasurementResult = {
  measurements: Map<string, TextMeasurement>
  totalTime: number
}

type VirtualItem<T> = {
  item: T
  index: number
  offset: number
  height: number
}

type VirtualMetrics = {
  totalHeight: number
  itemCount: number
  averageHeight: number
}

const MAX_CACHE_ENTRIES = 2000

const makeKey = (text: string, font: string, whiteSpace: WhiteSpaceMode) => {
  return `${font}\n${whiteSpace}\n${text}`
}

const preparedCache = new Map<string, PreparedEntry>()
const preparedSegmentsCache = new Map<string, PreparedSegmentsEntry>()

const evictIfNeeded = () => {
  if (preparedCache.size <= MAX_CACHE_ENTRIES) return

  const entries = Array.from(preparedCache.entries())
  entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed)

  const removeCount = Math.max(1, Math.floor(MAX_CACHE_ENTRIES * 0.1))
  for (let i = 0; i < removeCount && i < entries.length; i++) {
    preparedCache.delete(entries[i][0])
  }
}

const evictSegmentsIfNeeded = () => {
  if (preparedSegmentsCache.size <= MAX_CACHE_ENTRIES) return

  const entries = Array.from(preparedSegmentsCache.entries())
  entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed)

  const removeCount = Math.max(1, Math.floor(MAX_CACHE_ENTRIES * 0.1))
  for (let i = 0; i < removeCount && i < entries.length; i++) {
    preparedSegmentsCache.delete(entries[i][0])
  }
}

export const TextLayoutEngine = {
  prepare(text: string, font: string, options?: { whiteSpace?: WhiteSpaceMode }) {
    const whiteSpace: WhiteSpaceMode = options?.whiteSpace || 'normal'
    const key = makeKey(text, font, whiteSpace)

    const cached = preparedCache.get(key)
    if (cached) {
      cached.lastUsed = Date.now()
      return cached.prepared
    }

    const prepared = prepare(text, font, { whiteSpace })
    preparedCache.set(key, { prepared, lastUsed: Date.now() })
    evictIfNeeded()
    return prepared
  },

  prepareWithSegments(text: string, font: string, options?: { whiteSpace?: WhiteSpaceMode }) {
    const whiteSpace: WhiteSpaceMode = options?.whiteSpace || 'normal'
    const key = makeKey(text, font, whiteSpace)

    const cached = preparedSegmentsCache.get(key)
    if (cached) {
      cached.lastUsed = Date.now()
      return cached.prepared
    }

    const prepared = prepareWithSegments(text, font, { whiteSpace })
    preparedSegmentsCache.set(key, { prepared, lastUsed: Date.now() })
    evictSegmentsIfNeeded()
    return prepared
  },

  measureParagraph(text: string, font: string, maxWidth: number, lineHeight: number, options?: { whiteSpace?: WhiteSpaceMode }): ParagraphMeasurement {
    const prepared = TextLayoutEngine.prepare(text, font, options)
    const result = layout(prepared as any, maxWidth, lineHeight)
    
    const lineDetails: LineInfo[] = []
    let lineIndex = 0
    walkLineRanges(prepared as any, maxWidth, line => {
      lineDetails.push({
        width: (line as any).width,
        height: lineHeight,
        top: lineIndex * lineHeight,
        text: '' // Text extraction not directly available from walkLineRanges
      })
      lineIndex++
    })

    return {
      width: maxWidth,
      height: result.height,
      lines: lineDetails.length,
      lineDetails
    }
  },

  measureNaturalWidth(text: string, font: string, options?: { whiteSpace?: WhiteSpaceMode }) {
    const prepared = TextLayoutEngine.prepareWithSegments(text, font, options)
    let maxW = 0

    walkLineRanges(prepared as any, 1_000_000_000, line => {
      if (line.width > maxW) maxW = line.width
    })

    return maxW
  },

  measureHeight(text: string, font: string, maxWidth: number, lineHeight: number, options?: { whiteSpace?: WhiteSpaceMode }) {
    return TextLayoutEngine.measureParagraph(text, font, maxWidth, lineHeight, options).height
  },

  countLines(text: string, font: string, maxWidth: number, options?: { whiteSpace?: WhiteSpaceMode }): number {
    const prepared = TextLayoutEngine.prepare(text, font, options)
    let lineCount = 0
    walkLineRanges(prepared as any, maxWidth, () => {
      lineCount++
    })
    return lineCount
  },

  batchMeasure(
    items: { id: string; text: string }[],
    font: string,
    maxWidth: number,
    lineHeight: number,
    options?: { whiteSpace?: WhiteSpaceMode }
  ): BatchMeasurementResult {
    const startTime = performance.now()
    const measurements = new Map<string, TextMeasurement>()

    for (const item of items) {
      const para = TextLayoutEngine.measureParagraph(item.text, font, maxWidth, lineHeight, options)
      measurements.set(item.id, {
        text: item.text,
        width: para.width,
        height: para.height,
        lines: para.lines
      })
    }

    return {
      measurements,
      totalTime: performance.now() - startTime
    }
  },

  calculateLineClamp(
    text: string,
    font: string,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
    options?: { whiteSpace?: WhiteSpaceMode }
  ): { height: number; wasClamped: boolean; visibleText: string } {
    const prepared = TextLayoutEngine.prepareWithSegments(text, font, options)
    const lines: { width: number; text: string; y: number }[] = []
    let lineIndex = 0
    
    walkLineRanges(prepared as any, maxWidth, line => {
      lines.push({ width: (line as any).width, text: '', y: lineIndex * lineHeight })
      lineIndex++
    })

    const wasClamped = lines.length > maxLines
    const visibleLines = wasClamped ? lines.slice(0, maxLines) : lines
    const visibleText = visibleLines.map(l => l.text).join(' ')
    const height = visibleLines.length * lineHeight

    return { height, wasClamped, visibleText }
  },

  computeVirtualMetrics<T extends { id: string; text: string }>(
    items: T[],
    font: string,
    maxWidth: number,
    lineHeight: number,
    baseHeight: number,
    options?: { whiteSpace?: WhiteSpaceMode }
  ): { items: VirtualItem<T>[]; metrics: VirtualMetrics } {
    const startTime = performance.now()
    let totalOffset = 0
    const virtualItems: VirtualItem<T>[] = []

    for (let i = 0; i < items.length; i++) {
      const textHeight = TextLayoutEngine.measureHeight(
        items[i].text,
        font,
        maxWidth,
        lineHeight,
        options
      )
      const height = baseHeight + textHeight

      virtualItems.push({
        item: items[i],
        index: i,
        offset: totalOffset,
        height
      })

      totalOffset += height
    }

    const metrics: VirtualMetrics = {
      totalHeight: totalOffset,
      itemCount: items.length,
      averageHeight: totalOffset / items.length
    }

    console.log(`[TextLayoutEngine] Computed ${items.length} virtual items in ${(performance.now() - startTime).toFixed(2)}ms`)

    return { items: virtualItems, metrics }
  },

  computeOptimalColumns(
    items: { id: string; text: string }[],
    font: string,
    containerWidth: number,
    minColumnWidth: number,
    gap: number
  ): { columnCount: number; columnWidth: number; fits: boolean[] } {
    const fits: boolean[] = []
    let maxContentWidth = 0

    for (const item of items) {
      const width = TextLayoutEngine.measureNaturalWidth(item.text, font)
      fits.push(width <= minColumnWidth)
      if (width > maxContentWidth) maxContentWidth = width
    }

    const availableWidth = containerWidth + gap
    const effectiveColumnWidth = Math.max(minColumnWidth, maxContentWidth)
    const columnCount = Math.max(1, Math.floor(availableWidth / (effectiveColumnWidth + gap)))
    const columnWidth = (containerWidth - (columnCount - 1) * gap) / columnCount

    return { columnCount, columnWidth, fits }
  },

  measureWithTruncation(
    text: string,
    font: string,
    maxWidth: number,
    suffix: string = '...',
    options?: { whiteSpace?: WhiteSpaceMode }
  ): { text: string; truncated: boolean; width: number } {
    const naturalWidth = TextLayoutEngine.measureNaturalWidth(text, font, options)
    
    if (naturalWidth <= maxWidth) {
      return { text, truncated: false, width: naturalWidth }
    }

    let left = 0
    let right = text.length
    const suffixWidth = TextLayoutEngine.measureNaturalWidth(suffix, font, options)
    const availableWidth = maxWidth - suffixWidth

    while (left < right) {
      const mid = Math.ceil((left + right) / 2)
      const testText = text.slice(0, mid)
      const width = TextLayoutEngine.measureNaturalWidth(testText, font, options)

      if (width <= availableWidth) {
        left = mid
      } else {
        right = mid - 1
      }
    }

    const truncatedText = text.slice(0, left) + suffix
    return {
      text: truncatedText,
      truncated: true,
      width: TextLayoutEngine.measureNaturalWidth(truncatedText, font, options)
    }
  },

  clearCache() {
    preparedCache.clear()
    preparedSegmentsCache.clear()
  },

  getCacheStats() {
    return {
      preparedCacheSize: preparedCache.size,
      preparedSegmentsCacheSize: preparedSegmentsCache.size,
      memoryEstimate: (preparedCache.size + preparedSegmentsCache.size) * 0.5
    }
  }
}
