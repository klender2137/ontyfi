// TreeScreen-fixed.js - DISABLED - Use TreeScreen-final.js instead
// This file is disabled to prevent conflicts with the new centralized implementation
if (false && typeof window !== 'undefined' && window.React) {
  const { useState, useEffect, useMemo, useRef, useCallback, memo } = React;

  // Error Boundary Component
  class TreeErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
      console.error('TreeScreen error:', error, errorInfo);
      this.setState({ error });
    }

    render() {
      if (this.state.hasError) {
        return React.createElement('div', {
          className: 'screen',
          style: { padding: '2rem', textAlign: 'center' }
        }, [
          React.createElement('h2', {
            key: 'title',
            style: { color: '#ef4444', marginBottom: '1rem' }
          }, 'Tree View Error'),
          React.createElement('p', {
            key: 'desc',
            style: { color: '#94a3b8', marginBottom: '1rem' }
          }, 'Something went wrong with the tree visualization.'),
          React.createElement('button', {
            key: 'btn',
            className: 'primary-button',
            onClick: () => window.location.reload()
          }, 'Reload Page')
        ]);
      }
      return this.props.children;
    }
  }

  // Generic children accessor
  const getChildren = (node) => [
    ...(node.categories || []),
    ...(node.subcategories || []),
    ...(node.nodes || []),
    ...(node.subnodes || []),
    ...(node.leafnodes || [])
  ];

  // Tree walking utility
  const walkTree = (nodes, callback, path = []) => {
    if (!nodes || !Array.isArray(nodes)) return;
    
    nodes.forEach((node, index) => {
      if (!node || !node.id) return;
      
      const currentPath = [...path, node];
      callback(node, currentPath, index);
      const children = getChildren(node);
      if (children.length > 0) {
        walkTree(children, callback, currentPath);
      }
    });
  };

  // Memoized TreeTile component
  const TreeTile = memo(({ node, position, isExpanded, onMouseDown, onClick, onOpen, level, childrenCount }) => {
    if (!node || !position) return null;
    
    return React.createElement('div', {
      className: `tree-section-tile ${isExpanded ? 'tree-section-tile--active' : ''}`,
      style: {
        position: 'absolute',
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        zIndex: level,
        cursor: 'grab'
      },
      onMouseDown: (e) => onMouseDown && onMouseDown(e, node),
      onClick: () => onClick && onClick(node),
      onDoubleClick: () => onOpen && onOpen(node)
    }, [
      React.createElement('div', { key: 'title', className: 'tree-section-title' }, node.name),
      React.createElement('div', { key: 'meta', className: 'tree-section-meta' }, [
        ...(node.tags || []).slice(0, 3).map(tag => 
          React.createElement('span', { key: tag, className: 'tag-pill' }, tag)
        ),
        childrenCount > 0 && React.createElement('span', {
          key: 'indicator',
          className: 'tree-expand-indicator'
        }, isExpanded ? '−' : '+')
      ].filter(Boolean))
    ]);
  });

  function TreeScreen({ tree, onOpenArticle, bookmarksApi }) {
    console.log('TreeScreen: Component called with props:', { 
      tree: tree ? 'exists' : 'missing', 
      fields: tree?.fields?.length || 0,
      onOpenArticle: typeof onOpenArticle,
      bookmarksApi: typeof bookmarksApi
    });
    
    // Early validation - simplified
    if (!tree || !tree.fields || !Array.isArray(tree.fields) || tree.fields.length === 0) {
      console.error('TreeScreen: Invalid or empty tree data');
      return React.createElement('div', {
        className: 'screen',
        style: { padding: '2rem', textAlign: 'center' }
      }, [
        React.createElement('div', { key: 'text', className: 'secondary-text' }, 'No tree data available'),
        React.createElement('button', {
          key: 'btn',
          className: 'primary-button',
          onClick: () => window.location.reload()
        }, 'Reload Page')
      ]);
    }
    
    console.log('TreeScreen: Validation passed, fields count:', tree.fields.length);

    // React state - no localStorage usage
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [nodePositions, setNodePositions] = useState({});
    const [draggedNodeId, setDraggedNodeId] = useState(null);
    const [search, setSearch] = useState('');
    const dragInfo = useRef({ startX: 0, startY: 0, initialNodeX: 0, initialNodeY: 0 });
    const containerRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Simple grid layout calculation
    useEffect(() => {
      console.log('TreeScreen: Layout calculation triggered');
      if (!tree || !tree.fields) {
        console.log('TreeScreen: No tree data for layout');
        return;
      }
      
      const positions = {};
      let yOffset = 100;
      
      const calculateLayout = (nodes, level = 0, parentX = 100) => {
        if (!nodes || !Array.isArray(nodes)) {
          console.log('TreeScreen: Invalid nodes for layout:', nodes);
          return;
        }
        
        nodes.forEach((node, index) => {
          if (!node || !node.id) {
            console.log('TreeScreen: Invalid node:', node);
            return;
          }
          
          positions[node.id] = {
            x: parentX + level * 200,
            y: yOffset
          };
          yOffset += 120;
          
          if (expandedIds.has(node.id)) {
            const children = getChildren(node);
            if (children.length > 0) {
              calculateLayout(children, level + 1, parentX + level * 200 + 50);
            }
          }
        });
      };
      
      calculateLayout(tree.fields);
      console.log('TreeScreen: Calculated positions:', positions);
      setNodePositions(positions);
    }, [expandedIds, tree]);

    // Drag handlers
    const handleMouseMove = useCallback((e) => {
      if (!draggedNodeId || !dragInfo.current) return;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragInfo.current.startX;
        const deltaY = e.clientY - dragInfo.current.startY;
        
        setNodePositions(prev => ({
          ...prev,
          [draggedNodeId]: {
            x: dragInfo.current.initialNodeX + deltaX,
            y: dragInfo.current.initialNodeY + deltaY
          }
        }));
      });
    }, [draggedNodeId]);

    const handleMouseDown = useCallback((e, node) => {
      if (!node || !node.id) return;
      e.stopPropagation();
      
      const pos = nodePositions[node.id];
      if (!pos) return;
      
      setDraggedNodeId(node.id);
      dragInfo.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialNodeX: pos.x,
        initialNodeY: pos.y
      };
    }, [nodePositions]);

    const handleMouseUp = useCallback(() => {
      setDraggedNodeId(null);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }, []);

    const handleTileClick = useCallback((node) => {
      try {
        if (!node || !node.id) return;
        
        setExpandedIds(prev => {
          const next = new Set(prev);
          if (next.has(node.id)) {
            next.delete(node.id);
          } else {
            next.add(node.id);
          }
          return next;
        });
      } catch (error) {
        console.error('handleTileClick error:', error);
      }
    }, []);

    // Flatten tree for search
    const flatNodes = useMemo(() => {
      if (!tree || !tree.fields) return [];
      
      const result = [];
      walkTree(tree.fields, (node, path) => {
        result.push({ ...node, path: path.slice(0, -1).map(n => ({ id: n.id, name: n.name })) });
      });
      return result;
    }, [tree]);

    const filteredResults = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return [];
      
      if (q.includes(' / ')) {
        const pathParts = q.split(' / ').map(p => p.trim());
        return flatNodes.filter(n => {
          if (!n.path) return false;
          const nodePath = [...n.path.map(p => p.name), n.name];
          return pathParts.length === nodePath.length && 
                 pathParts.every((part, i) => nodePath[i].toLowerCase().includes(part));
        });
      }
      
      return flatNodes.filter(n =>
        n.name.toLowerCase().includes(q) ||
        n.description?.toLowerCase().includes(q) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }, [flatNodes, search]);

    const renderRecursive = useCallback((node, level = 0) => {
      try {
        if (!node || !node.id) {
          console.log('TreeScreen: Invalid node in renderRecursive:', node);
          return null;
        }
        
        // Null-safe position rendering with default coordinates
        const pos = nodePositions[node.id] || { x: 100 + level * 200, y: 100 + level * 120 };
        
        console.log(`TreeScreen: Rendering node ${node.id} at position:`, pos);

        const children = getChildren(node);
        const isExpanded = expandedIds.has(node.id);

        return React.createElement(React.Fragment, { key: node.id }, [
          React.createElement(TreeTile, {
            key: `tile-${node.id}`,
            node,
            position: pos,
            level,
            isExpanded,
            childrenCount: children.length,
            onMouseDown: handleMouseDown,
            onOpen: onOpenArticle,
            onClick: handleTileClick
          }),
          ...(isExpanded ? children.map(child => {
            try {
              return renderRecursive(child, level + 1);
            } catch (error) {
              console.error('Child render error:', error);
              return null;
            }
          }).filter(Boolean) : [])
        ]);
      } catch (error) {
        console.error('renderRecursive error:', error);
        return null;
      }
    }, [nodePositions, expandedIds, handleMouseDown, handleTileClick, onOpenArticle]);

    return React.createElement('div', {
      className: 'screen',
      style: { padding: 0, margin: 0, height: '100vh', overflow: 'hidden' }
    }, [
      // Search bar
      React.createElement('div', {
        key: 'search-bar',
        className: 'search-bar',
        style: { position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 200 }
      }, [
        React.createElement('input', {
          key: 'search-input',
          className: 'search-input',
          placeholder: 'Search inside the CryptoMap tree...',
          value: search,
          onChange: e => setSearch(e.target.value)
        })
      ]),

      // Tree space or search results
      !search ? React.createElement('div', {
        key: 'tree-space',
        ref: containerRef,
        className: 'tree-space',
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseUp,
        style: {
          position: 'relative',
          width: '100%',
          height: '100vh',
          overflow: 'hidden',
          background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.8), rgba(5, 8, 20, 0.9))',
          cursor: draggedNodeId ? 'grabbing' : 'grab'
        }
      }, tree.fields.map((field, index) => {
        console.log(`TreeScreen: Rendering field ${index}:`, field);
        try {
          const result = renderRecursive(field);
          console.log(`TreeScreen: Field ${index} render result:`, result);
          return result;
        } catch (error) {
          console.error('Field render error:', error);
          return null;
        }
      }).filter(Boolean)) : React.createElement('div', {
        key: 'search-results',
        className: 'search-results'
      }, [
        filteredResults.length === 0 ? 
          React.createElement('div', { 
            key: 'no-results',
            className: 'secondary-text' 
          }, 'No matches found.') :
          React.createElement('div', { key: 'results' }, 
            filteredResults.map(n => 
              React.createElement('div', {
                key: n.id,
                className: 'search-result-item'
              }, [
                React.createElement('div', {
                  key: 'content',
                  onClick: () => onOpenArticle && onOpenArticle(n)
                }, [
                  React.createElement('div', {
                    key: 'name',
                    className: 'search-result-name'
                  }, n.name),
                  React.createElement('div', {
                    key: 'path',
                    className: 'search-result-path'
                  }, n.path ? n.path.map(p => p.name).join(' / ') : '')
                ]),
                React.createElement('button', {
                  key: 'bookmark',
                  className: `bookmark-toggle ${bookmarksApi?.isBookmarked(n.id) ? 'bookmark-toggle--active' : ''}`,
                  onClick: e => { e.stopPropagation(); bookmarksApi?.toggleBookmark(n); }
                }, bookmarksApi?.isBookmarked(n.id) ? 'Bookmarked' : 'Bookmark')
              ])
            )
          )
      ])
    ]);
  }

  // Wrapped TreeScreen with Error Boundary
  function SafeTreeScreen(props) {
    return React.createElement(TreeErrorBoundary, null,
      React.createElement(TreeScreen, props)
    );
  }

  window.TreeScreen = SafeTreeScreen;
}