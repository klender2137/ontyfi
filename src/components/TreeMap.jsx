import { useNavigate, useLocation } from 'react-router-dom'
import { useTreeData } from '../hooks/useTreeData'
import { useAppStore } from '../store/useAppStore'
import LoadingSkeleton from './LoadingSkeleton'
import TreeTile from './TreeTile'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTouchGesture, useLongPress } from '../hooks/useTouchGesture'
import { useTilePositioning } from '../hooks/useTilePositioning'
import { useDebounce, useDebouncedCallback } from '../hooks/usePerformanceOptimizations'

const DEBOUNCE_DELAY = 300; // 300ms debounce for geometry calculations

const TreeMap = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { tree, loading, error } = useTreeData()
  const { toggleBookmark, isBookmarked } = useAppStore()

  // Get archetype result from navigation state
  const archetypeResult = location.state?.archetypeResult
  const highlightField = location.state?.highlightField

  const [expandedTiles, setExpandedTiles] = useState(new Set())
  const [showArchetypeBanner, setShowArchetypeBanner] = useState(!!archetypeResult)
  const [justExpanded, setJustExpanded] = useState(new Set())
  const [tilePositions, setTilePositions] = useState({})
  const [tileDragStates, setTileDragStates] = useState({})
  const [dragStartPositions, setDragStartPositions] = useState({})
  const tileRefs = useRef({})
  const originalGridPositions = useRef({});
  const userDraggedTiles = useRef(new Set());

  // Initialize anti-clutter positioning system
  const {
    tilePositions: positionedTiles,
    calculateSpawnPosition,
    registerTile,
    unregisterTile,
    isAreaClear,
    getStats
  } = useTilePositioning({
    minTileDistance: 180,
    safetyBuffer: 1.5,
    repulsionStrength: 3.0,
    enablePhysics: true,
    enablePoissonDisc: true,
    enableBranchBoundaries: true
  });

  // Track which tiles should use anti-clutter positioning vs grid
  const [unfoldedTiles, setUnfoldedTiles] = useState(new Set());
  const [tileAbsolutePositions, setTileAbsolutePositions] = useState({});
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef(null)

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        background: '#0f172a', 
        color: '#f7f9ff', 
        minHeight: '100vh',
        touchAction: 'pan-y'
      }}>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Failed to Load Tree</h2>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
          {error}. Please check your connection and try again.
        </p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            minWidth: '44px',
            minHeight: '44px',
            touchAction: 'manipulation'
          }}
        >
          Reload Data
        </button>
      </div>
    )
  }

  const flattenNodes = (nodes, path = []) => {
    return nodes.reduce((acc, node) => {
      const currentPath = [...path, { id: node.id, name: node.name }]
      const children = [
        ...(node.categories || []),
        ...(node.subcategories || []),
        ...(node.nodes || []),
        ...(node.subnodes || []),
        ...(node.leafnodes || [])
      ]
      return [...acc, { ...node, path: currentPath }, ...flattenNodes(children, currentPath)]
    }, [])
  }

  const allNodes = useMemo(() => {
    return tree ? flattenNodes(tree.fields) : []
  }, [tree])

  const combinedTiles = useMemo(() => {
    return allNodes.slice(0, 20)
  }, [allNodes])

  const getRandomPosition = (nodeId, parentRect = null) => {
    const basePositions = [
      { top: '10px', left: '10px' },
      { top: '10px', right: '10px' },
      { bottom: '10px', left: '10px' },
      { bottom: '10px', right: '10px' },
      { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
      { top: '10px', left: '50%', transform: 'translateX(-50%)' },
      { bottom: '10px', left: '50%', transform: 'translateX(-50%)' }
    ]
    
    const positions = parentRect ? [
      { top: `${parentRect.top + 10}px`, left: `${parentRect.left + 10}px` },
      { top: `${parentRect.top + 10}px`, right: `${parentRect.right + 10}px` },
      { bottom: `${parentRect.bottom + 10}px`, left: `${parentRect.left + 10}px` },
      { bottom: `${parentRect.bottom + 10}px`, right: `${parentRect.right + 10}px` }
    ] : basePositions
    
    return positions[Math.floor(Math.random() * positions.length)]
  }

  const handleTileDrag = (nodeId) => {
    setTileDragStates(prev => ({
      ...prev,
      [nodeId]: { wasDragged: true, lastPosition: Date.now() }
    }))
  }

  const debouncedToggleExpansion = useDebouncedCallback((nodeId) => {
    setJustExpanded(prevJust => {
      const next = new Set(prevJust)
      next.delete(nodeId)
      return next
    })
  }, 300)

  const toggleTileExpansion = useCallback((nodeId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    setExpandedTiles(prev => {
      const newSet = new Set(prev)
      const parentRect = null
      
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
        setJustExpanded(prevJust => {
          const next = new Set(prevJust)
          next.delete(nodeId)
          return next
        })
      } else {
        // Track tile open for quests ONLY when expanding
        if (typeof window !== 'undefined' && window.Gamification && window.Gamification.trackTileOpen) {
          window.Gamification.trackTileOpen(nodeId).catch(err => console.warn('Quest tracking failed:', err));
        }

        newSet.add(nodeId)
        setJustExpanded(prevJust => new Set(prevJust).add(nodeId))
        debouncedToggleExpansion(nodeId)

        setTilePositions(prev => ({
          ...prev,
          [nodeId]: getRandomPosition(nodeId, parentRect)
        }))
      }
      return newSet
    })
  }, [debouncedToggleExpansion])

  // Pinch zoom handlers
  const handlePinchStart = useCallback(({ scale }) => {
    console.log('[TreeMap] Pinch start, initial scale:', scale);
  }, []);

  const handlePinchMove = useCallback(({ scale }) => {
    setZoomScale(Math.max(0.5, Math.min(2, scale)));
  }, []);

  const handlePinchEnd = useCallback(({ scale }) => {
    console.log('[TreeMap] Pinch end, final scale:', scale);
    setZoomScale(prev => Math.max(0.5, Math.min(2, prev)));
  }, []);

  // Pan handlers for the container
  const handlePanMove = useCallback(({ dx, dy }) => {
    setPanOffset(prev => ({
      x: prev.x + dx * 0.5,
      y: prev.y + dy * 0.5
    }));
  }, []);

  // Touch gesture setup for the container
  const { ref: gestureRef } = useTouchGesture({
    onPinchStart: handlePinchStart,
    onPinchMove: handlePinchMove,
    onPinchEnd: handlePinchEnd,
    onPanMove: handlePanMove,
  });

  // Merge refs
  const setContainerRef = useCallback((node) => {
    containerRef.current = node;
    gestureRef.current = node;
  }, [gestureRef]);

  // Effect: Register tiles in positioning system when they unfold
  useEffect(() => {
    combinedTiles.forEach(node => {
      const isExpanded = expandedTiles.has(node.id);
      const isUnfolded = unfoldedTiles.has(node.id);
      const tileEl = tileRefs.current[node.id];
      
      if (isExpanded && !isUnfolded && tileEl) {
        // Tile just expanded - capture its ORIGINAL grid position
        const rect = tileEl.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        
        if (containerRect) {
          // Calculate position relative to container
          const relativeX = rect.left - containerRect.left;
          const relativeY = rect.top - containerRect.top;
          
          // Store the ORIGINAL position - this is where user expects to see the tile
          const originalPos = {
            x: relativeX,
            y: relativeY,
            width: rect.width,
            height: Math.max(rect.height, isExpanded ? 300 : 200)
          };
          
          // Save original position BEFORE registering (so physics doesn't move it from user view)
          originalGridPositions.current[node.id] = originalPos;
          
          // Determine branch from path
          const branchId = node.path?.[0]?.id || 'root';
          
          // Register with occupancy map using ORIGINAL position
          registerTile(node.id, originalPos, branchId);
          
          // Mark as unfolded
          setUnfoldedTiles(prev => new Set(prev).add(node.id));
          
          // Store absolute position - use ORIGINAL position, not physics-adjusted
          setTileAbsolutePositions(prev => ({
            ...prev,
            [node.id]: { x: originalPos.x, y: originalPos.y }
          }));
        }
      } else if (!isExpanded && isUnfolded) {
        // Tile collapsed - unregister and clean up
        unregisterTile(node.id);
        delete originalGridPositions.current[node.id];
        setUnfoldedTiles(prev => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
        setTileAbsolutePositions(prev => {
          const next = { ...prev };
          delete next[node.id];
          return next;
        });
      }
    });
  }, [expandedTiles, combinedTiles, registerTile, unregisterTile, unfoldedTiles]);

  // Effect: Update positioned tiles when positioning system reports changes
  // BUT only for tiles that have been dragged by user (not auto-positioned)
  useEffect(() => {
    const newPositions = {};
    let hasChanges = false;
    
    for (const [tileId, pos] of Object.entries(positionedTiles)) {
      // Only update position if user has dragged this tile, OR if it's a new tile from physics
      const current = tileAbsolutePositions[tileId];
      const isUserDragged = userDraggedTiles.current.has(tileId);
      
      if (current && isUserDragged && (current.x !== pos.x || current.y !== pos.y)) {
        newPositions[tileId] = pos;
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      setTileAbsolutePositions(prev => ({
        ...prev,
        ...newPositions
      }));
    }
  }, [positionedTiles, tileAbsolutePositions]);

  return (
    <div 
      ref={setContainerRef}
      style={{ 
        padding: '2rem', 
        background: '#0f172a', 
        color: '#f7f9ff', 
        minHeight: '100vh',
        touchAction: 'pan-x pan-y pinch-zoom',
        transform: `scale(${zoomScale}) translate(${panOffset.x}px, ${panOffset.y}px)`,
        transformOrigin: 'center center',
        transition: 'transform 0.1s ease-out'
      }}
    >
      {/* Archetype Result Banner */}
      {showArchetypeBanner && archetypeResult && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(167, 139, 250, 0.15) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>
              {archetypeResult.topField?.fieldData?.icon || '◈'}
            </span>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Finance Archetype
              </p>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f7f9ff' }}>
                {archetypeResult.topField?.fieldData?.label || 'Unknown'}
                <span style={{ color: '#3b82f6', marginLeft: '0.5rem' }}>
                  ({archetypeResult.topField?.fieldData?.archetype})
                </span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => navigate('/archetype-diagnostic')}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                color: '#f7f9ff',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Retake Test
            </button>
            <button
              onClick={() => setShowArchetypeBanner(false)}
              style={{
                padding: '0.5rem',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '1.25rem',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <h2>CryptoMap Tree</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Zoom controls for accessibility */}
          <button 
            onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.1))}
            style={{
              padding: '0.5rem',
              minWidth: '44px',
              minHeight: '44px',
              background: '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1.2rem',
              touchAction: 'manipulation',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Zoom out"
          >
            −
          </button>
          <span style={{ 
            padding: '0.5rem', 
            minWidth: '44px',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#94a3b8'
          }}>
            {Math.round(zoomScale * 100)}%
          </span>
          <button 
            onClick={() => setZoomScale(prev => Math.min(2, prev + 0.1))}
            style={{
              padding: '0.5rem',
              minWidth: '44px',
              minHeight: '44px',
              background: '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1.2rem',
              touchAction: 'manipulation',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button 
            onClick={() => navigate('/')}
            style={{ 
              padding: '0.75rem 1rem', 
              minWidth: '44px',
              minHeight: '44px',
              background: '#374151', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer',
              touchAction: 'manipulation',
              fontSize: '0.875rem'
            }}
          >
            ← Home
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '1rem',
        touchAction: 'pan-y',
        position: 'relative'
      }}>
        {combinedTiles.map(node => {
          const isExpanded = expandedTiles.has(node.id)
          const position = tilePositions[node.id] || { top: '10px', left: '10px' }
          const isNewArticle = node.isNewArticle
          
          // Check if this tile matches the highlighted archetype field
          const nodeName = node.name?.toLowerCase() || ''
          const highlightMatch = highlightField && archetypeResult?.topField?.fieldData
          const isHighlighted = highlightMatch && (
            nodeName.includes(archetypeResult.topField.fieldData.label.toLowerCase()) ||
            nodeName.includes(highlightField.toLowerCase()) ||
            (archetypeResult.topField.key === 'QuantFin' && nodeName.includes('quant')) ||
            (archetypeResult.topField.key === 'IB' && (nodeName.includes('bank') || nodeName.includes('ib'))) ||
            (archetypeResult.topField.key === 'VC' && nodeName.includes('venture')) ||
            (archetypeResult.topField.key === 'RiskM' && nodeName.includes('risk')) ||
            (archetypeResult.topField.key === 'HedgeFund' && nodeName.includes('hedge')) ||
            (archetypeResult.topField.key === 'FPA' && nodeName.includes('fp')) ||
            (archetypeResult.topField.key === 'AssetMgmt' && nodeName.includes('asset')) ||
            (archetypeResult.topField.key === 'PublicFin' && nodeName.includes('public')) ||
            (archetypeResult.topField.key === 'PE' && nodeName.includes('private'))
          )
          const fieldColor = archetypeResult?.topField?.fieldData?.color || '#3b82f6'
          const isUnfolded = unfoldedTiles.has(node.id)
          const absolutePos = tileAbsolutePositions[node.id]
          
          // Use absolute positioning when unfolded, grid otherwise with GPU acceleration
          const tileStyle = isUnfolded && absolutePos ? {
            position: 'absolute',
            left: absolutePos.x,
            top: absolutePos.y,
            width: 300,
            minHeight: '200px',
            height: isExpanded ? 'auto' : '200px',
            padding: '12px',
            background: isHighlighted 
              ? `linear-gradient(135deg, ${fieldColor}20, ${fieldColor}10)`
              : isNewArticle 
                ? 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(16,185,129,0.08))' 
                : 'rgba(15, 23, 42, 0.95)',
            border: isHighlighted
              ? `1px solid ${fieldColor}`
              : isNewArticle 
                ? '1px solid rgba(34,211,238,0.5)' 
                : '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            cursor: 'move',
            willChange: 'transform',
            transform: `translate3d(0, 0, 0)`,
            zIndex: isExpanded ? 10 : 1,
            boxShadow: isExpanded ? '0 8px 24px rgba(0,0,0,0.4)' : 'none'
          } : {
            minHeight: '200px',
            height: isExpanded ? 'auto' : '200px',
            padding: '12px',
            background: isHighlighted 
              ? `linear-gradient(135deg, ${fieldColor}20, ${fieldColor}10)`
              : isNewArticle 
                ? 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(16,185,129,0.08))' 
                : 'rgba(15, 23, 42, 0.8)',
            border: isHighlighted
              ? `1px solid ${fieldColor}`
              : isNewArticle 
                ? '1px solid rgba(34,211,238,0.5)' 
                : '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '8px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            willChange: 'transform',
            transform: 'translate3d(0, 0, 0)'
          }
          return (
            <div 
              key={node.id}
              ref={el => tileRefs.current[node.id] = el}
              onPointerDown={(e) => {
                // Store drag start position for detecting drag vs click
                setDragStartPositions(prev => ({
                  ...prev,
                  [node.id]: { x: e.clientX, y: e.clientY, time: Date.now() }
                }));
              }}
              onPointerMove={(e) => {
                // Only handle if we're dragging this tile
                if (!dragStartPositions[node.id]) return;
                
                const startPos = dragStartPositions[node.id];
                const dx = e.clientX - startPos.x;
                const dy = e.clientY - startPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // If moved more than 5px, consider it a drag
                if (distance > 5) {
                  handleTileDrag(node.id);
                  userDraggedTiles.current.add(node.id);
                  
                  // Update the tile position for absolute positioning
                  const containerRect = containerRef.current?.getBoundingClientRect();
                  if (containerRect) {
                    const newX = e.clientX - containerRect.left - 150; // Center on pointer
                    const newY = e.clientY - containerRect.top - 100;
                    setTileAbsolutePositions(prev => ({
                      ...prev,
                      [node.id]: { x: newX, y: newY }
                    }));
                  }
                }
              }}
              onPointerUp={(e) => {
                const startPos = dragStartPositions[node.id];
                if (startPos) {
                  const dx = e.clientX - startPos.x;
                  const dy = e.clientY - startPos.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  const timeDiff = Date.now() - startPos.time;
                  
                  // If moved less than 5px and within 300ms, it's a click - navigate
                  if (distance < 5 && timeDiff < 300) {
                    // Only navigate if not already tracked as dragged
                    if (!tileDragStates[node.id]?.wasDragged) {
                      navigate(`/article/${node.id}`);
                    }
                  } else {
                    // It's a drag - update final position
                    handleTileDrag(node.id);
                    userDraggedTiles.current.add(node.id);
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    const tileEl = tileRefs.current[node.id];
                    if (containerRect && tileEl) {
                      const rect = tileEl.getBoundingClientRect();
                      const newX = rect.left - containerRect.left;
                      const newY = rect.top - containerRect.top;
                      setTileAbsolutePositions(prev => ({
                        ...prev,
                        [node.id]: { x: newX, y: newY }
                      }));
                    }
                  }
                  
                  // Clear drag start position
                  setDragStartPositions(prev => {
                    const next = { ...prev };
                    delete next[node.id];
                    return next;
                  });
                }
              }}
              onClick={(e) => {
                // Reset drag state on click
                if (tileDragStates[node.id]?.wasDragged) {
                  setTileDragStates(prev => {
                    const next = { ...prev };
                    delete next[node.id];
                    return next;
                  });
                }
              }}
              style={{
                ...tileStyle,
                cursor: isUnfolded && absolutePos ? 'move' : 'pointer',
                touchAction: 'none' // Enable custom touch handling
              }}
            >
              {/* New Article Badge */}
              {isNewArticle && (
                <div 
                  style={{ 
                    fontSize: '10px', 
                    fontWeight: '700', 
                    color: '#06b6d4',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    marginBottom: '8px',
                    opacity: '0.9',
                    flexShrink: 0
                  }}
                >
                  New Article
                </div>
              )}
              
              {/* Title */}
              <div style={{ flexShrink: 0, marginBottom: '8px' }}>
                <h4 
                  onClick={(e) => {
                    if (!tileDragStates[node.id]?.wasDragged) {
                      navigate(`/article/${node.id}`)
                    }
                  }}
                  style={{ 
                    margin: '0 0 8px 0', 
                    color: '#f7f9ff',
                    fontSize: '14px',
                    fontWeight: '600',
                    lineHeight: '1.3',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    minHeight: '20px',
                    transition: 'color 0.2s'
                  }}
                >
                  {node.name}
                </h4>
              </div>
              
              {/* Description */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <p style={{ 
                  color: '#94a3b8', 
                  fontSize: '12px', 
                  margin: '0',
                  lineHeight: '1.4',
                  display: '-webkit-box',
                  WebkitLineClamp: isExpanded ? 6 : 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {node.description || 'Loading description...'}
                </p>
                {node.descriptionRef && (
                  <div style={{ 
                    fontSize: '9px', 
                    color: '#10b981', 
                    marginTop: '4px',
                    fontStyle: 'italic'
                  }}>
                    From: {node.descriptionRef.split('/').pop()}
                  </div>
                )}
              </div>
              
              <div style={{ flexShrink: 0, marginTop: 'auto', paddingTop: '12px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={(e) => toggleTileExpansion(node.id, e)}
                    style={{
                      padding: '10px 14px',
                      minHeight: '44px',
                      background: isNewArticle ? '#06b6d4' : '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '500',
                      flex: 1,
                      touchAction: 'manipulation',
                      transition: 'transform 0.1s ease, background-color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isExpanded ? 'Fold' : 'Expand'}
                  </button>
                  {isNewArticle && node.external_link ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          window.open(node.external_link, '_blank', 'noopener,noreferrer');
                        } catch (err) {
                          console.error('Open external link error:', err);
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        minHeight: '44px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '500',
                        flex: 1,
                        touchAction: 'manipulation',
                        transition: 'transform 0.1s ease, background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      Open
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(node);
                      }}
                      style={{
                        padding: '10px 14px',
                        minHeight: '44px',
                        background: isBookmarked(node.id) ? '#10b981' : '#374151',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '500',
                        flex: 1,
                        touchAction: 'manipulation',
                        transition: 'transform 0.1s ease, background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {isBookmarked(node.id) ? 'Bookmarked' : 'Bookmark'}
                    </button>
                  )}
                </div>
                
                {/* Tags Section - Inside tile, one row only */}
                {isExpanded && node.tags && node.tags.length > 0 && (
                  <div style={{ 
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: isNewArticle ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(148, 163, 184, 0.2)'
                  }}>
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#64748b', 
                      marginBottom: '6px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Tags
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'nowrap', 
                      gap: '4px',
                      overflow: 'hidden'
                    }}>
                      {node.tags.slice(0, 4).map(tag => (
                        <span 
                          key={tag}
                          style={{
                            background: isNewArticle ? 'rgba(34,211,238,0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: isNewArticle ? '#06b6d4' : '#60a5fa',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            border: isNewArticle ? '1px solid rgba(34,211,238,0.25)' : '1px solid rgba(59, 130, 246, 0.25)',
                            flexShrink: 0
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {node.tags.length > 4 && (
                        <span style={{
                          fontSize: '10px',
                          color: '#94a3b8',
                          padding: '4px 0',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          +{node.tags.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TreeMap