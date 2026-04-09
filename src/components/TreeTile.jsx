import React, { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Memoized TreeTile component
 * Prevents unnecessary re-renders when parent state changes
 * Only re-renders when its own props change
 */
const TreeTile = memo(function TreeTile({
  node,
  isExpanded,
  isNewArticle,
  isBookmarked,
  onToggleExpansion,
  onToggleBookmark,
  style
}) {
  const navigate = useNavigate();
  
  const handleTitleClick = useCallback((e) => {
    navigate(`/article/${node.id}`);
  }, [navigate, node.id]);
  
  const handleExpandClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onToggleExpansion(node.id);
  }, [onToggleExpansion, node.id]);
  
  const handleBookmarkClick = useCallback((e) => {
    e.stopPropagation();
    onToggleBookmark(node);
  }, [onToggleBookmark, node]);
  
  return (
    <div 
      style={{
        ...style,
        willChange: 'transform',
        transform: style.transform || 'translate3d(0, 0, 0)'
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
          onClick={handleTitleClick}
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
      </div>
      
      <div style={{ flexShrink: 0, marginTop: 'auto', paddingTop: '12px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleExpandClick}
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
              touchAction: 'manipulation'
            }}
          >
            {isExpanded ? 'Fold' : 'Expand'}
          </button>
          <button
            onClick={handleBookmarkClick}
            style={{
              padding: '10px 14px',
              minHeight: '44px',
              background: isBookmarked ? '#10b981' : '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              flex: 1,
              touchAction: 'manipulation'
            }}
          >
            {isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
        </div>
        
        {/* Tags Section */}
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
  );
});

export default TreeTile;
