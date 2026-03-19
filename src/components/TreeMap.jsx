import { useNavigate } from 'react-router-dom'
import { useTreeData } from '../hooks/useTreeData'
import { useAppStore } from '../store/useAppStore'
import LoadingSkeleton from './LoadingSkeleton'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useInsightsV1Latest } from '../hooks/useInsightsV1Latest'

const TreeMap = () => {
  const navigate = useNavigate()
  const { tree, loading, error } = useTreeData()
  const { toggleBookmark, isBookmarked } = useAppStore()
  const [expandedTiles, setExpandedTiles] = useState(new Set())
  const [tilePositions, setTilePositions] = useState({})
  const [tileDragStates, setTileDragStates] = useState({})
  const tileRefs = useRef({})
  const { items: latestInsights, loading: insightsLoading, error: insightsError } = useInsightsV1Latest({ limit: 6 })

  if (loading) return <LoadingSkeleton />
  
  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#0f172a', color: '#f7f9ff', minHeight: '100vh' }}>
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
            cursor: 'pointer'
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

  const allNodes = tree ? flattenNodes(tree.fields) : []

  const newArticlesTiles = useMemo(() => {
    if (!latestInsights.length) return [];
    return latestInsights.map((insight, idx) => ({
      id: `insight-${insight.docId || insight.id}-${idx}`,
      name: insight.title || 'Untitled Insight',
      description: insight.content ? (insight.content.length > 240 ? insight.content.slice(0, 240) + '…' : insight.content) : 'No description',
      tags: [insight.source || 'Insights', insight.category || 'Insight'],
      external_link: insight.external_link || null,
      publication_date: insight.publication_date || null,
      image_url: insight.image_url || null,
      source: insight.source || 'Insights',
      category: insight.category || 'Insight',
      type: insight.type || 'Insight',
      timestamp: insight.timestamp || null,
      isNewArticle: true
    }));
  }, [latestInsights]);

  const combinedTiles = useMemo(() => {
    return [...newArticlesTiles, ...allNodes.slice(0, Math.max(0, 20 - newArticlesTiles.length))];
  }, [newArticlesTiles, allNodes]);

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

  const toggleTileExpansion = (nodeId) => {
    setExpandedTiles(prev => {
      const newSet = new Set(prev)
      const tileElement = tileRefs.current[nodeId]
      let parentRect = null
      
      if (tileElement && tileDragStates[nodeId]?.wasDragged) {
        const rect = tileElement.getBoundingClientRect()
        parentRect = {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom
        }
      }
      
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
        setTilePositions(prev => ({
          ...prev,
          [nodeId]: getRandomPosition(nodeId, parentRect)
        }))
      }
      return newSet
    })
  }

  return (
    <div style={{ padding: '2rem', background: '#0f172a', color: '#f7f9ff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>CryptoMap Tree</h2>
        <button 
          onClick={() => navigate('/')}
          style={{ 
            padding: '0.5rem 1rem', 
            background: '#374151', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer' 
          }}
        >
          ← Home
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {combinedTiles.map(node => {
          const isExpanded = expandedTiles.has(node.id)
          const position = tilePositions[node.id] || { top: '10px', left: '10px' }
          const isNewArticle = node.isNewArticle
          
          return (
            <div 
              key={node.id}
              ref={el => tileRefs.current[node.id] = el}
              draggable
              onDragEnd={() => handleTileDrag(node.id)}
              style={{ 
                height: '200px',
                padding: '12px',
                background: isNewArticle ? 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(16,185,129,0.08))' : 'rgba(15, 23, 42, 0.8)',
                border: isNewArticle ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                cursor: 'move'
              }}
            >
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                gap: '8px'
              }}>
                <div style={{ flexShrink: 0 }}>
                  {isNewArticle && (
                    <div style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#06b6d4',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      marginBottom: '4px',
                      opacity: 0.9
                    }}>New Article</div>
                  )}
                  <h4 style={{ 
                    margin: '0', 
                    color: '#f7f9ff',
                    fontSize: '14px',
                    fontWeight: '600',
                    lineHeight: '1.3',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {node.name}
                  </h4>
                </div>
                
                <div style={{ flex: 1, minHeight: 0 }}>
                  <p style={{ 
                    color: '#94a3b8', 
                    fontSize: '12px', 
                    margin: '0',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {node.description || `No description available for ${node.name}`}
                  </p>
                  {node.descriptionRef && !node.description && (
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#f59e0b', 
                      marginTop: '4px',
                      fontStyle: 'italic'
                    }}>
                      Loading from @{node.descriptionRef}
                    </div>
                  )}
                  {node.description && node.descriptionRef && (
                    <div style={{ 
                      fontSize: '9px', 
                      color: '#10b981', 
                      marginTop: '4px',
                      fontStyle: 'italic'
                    }}>
                      ✅ Loaded from @{node.descriptionRef}
                    </div>
                  )}
                </div>
                
                <div style={{ flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => toggleTileExpansion(node.id)}
                      style={{
                        padding: '6px 10px',
                        background: isNewArticle ? '#06b6d4' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '500',
                        flex: 1,
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.background = isNewArticle ? '#0891b2' : '#4b5563'}
                      onMouseOut={(e) => e.target.style.background = isNewArticle ? '#06b6d4' : '#6b7280'}
                    >
                      {isExpanded ? 'Fold' : 'Expand'}
                    </button>
                    {isNewArticle && node.external_link ? (
                      <button
                        onClick={() => {
                          try {
                            window.open(node.external_link, '_blank', 'noopener,noreferrer');
                          } catch (e) {
                            console.error('Open external link error:', e);
                          }
                        }}
                        style={{
                          padding: '6px 10px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '500',
                          flex: 1,
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#059669'}
                        onMouseOut={(e) => e.target.style.background = '#10b981'}
                      >
                        Open
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleBookmark(node)}
                        style={{
                          padding: '6px 10px',
                          background: isBookmarked(node.id) ? '#10b981' : '#374151',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '500',
                          flex: 1,
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.background = isBookmarked(node.id) ? '#059669' : '#4b5563'}
                        onMouseOut={(e) => e.target.style.background = isBookmarked(node.id) ? '#10b981' : '#374151'}
                      >
                        {isBookmarked(node.id) ? 'Bookmarked' : 'Bookmark'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {isExpanded && node.tags && node.tags.length > 0 && (
                <div 
                  style={{ 
                    position: 'absolute',
                    ...position,
                    background: 'rgba(15, 23, 42, 0.95)',
                    padding: '8px',
                    borderRadius: '6px',
                    border: isNewArticle ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(148, 163, 184, 0.3)',
                    zIndex: 10,
                    maxWidth: '200px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#64748b', 
                    marginBottom: '4px',
                    fontWeight: '600'
                  }}>
                    {isNewArticle ? 'Article tags:' : 'Tags from description:'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {node.tags.slice(0, 6).map(tag => (
                      <span 
                        key={tag}
                        style={{
                          background: isNewArticle ? 'rgba(34,211,238,0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: isNewArticle ? '#06b6d4' : '#60a5fa',
                          padding: '3px 6px',
                          borderRadius: '3px',
                          fontSize: '10px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          border: isNewArticle ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                    {node.tags.length > 6 && (
                      <span style={{
                        fontSize: '9px',
                        color: '#94a3b8',
                        fontStyle: 'italic'
                      }}>
                        +{node.tags.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TreeMap