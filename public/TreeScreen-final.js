// TreeScreen-final.js - DISABLED - Reverting to original visual tree map
// This list-based implementation is disabled in favor of the visual tree map
if (false) {
  'use strict';
  
  if (typeof React === 'undefined') {
    console.error('React not available for TreeScreen');
    return;
  }

  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  // CENTRALIZED DATA SOURCE - Only use CryptoTree.json
  let treeData = null;

  // Load tree data from centralized source
  async function loadTreeData() {
    try {
      // Priority 1: API endpoint
      const response = await fetch('/api/tree');
      if (response.ok) {
        const data = await response.json();
        if (data && data.fields && Array.isArray(data.fields)) {
          treeData = data;
          console.log('✅ Tree data loaded from API:', data.fields.length, 'fields');
          return data;
        }
      }
      
      // Priority 2: Direct JSON file
      const jsonResponse = await fetch('/data/cryptoTree.json');
      if (jsonResponse.ok) {
        const data = await jsonResponse.json();
        if (data && data.fields && Array.isArray(data.fields)) {
          treeData = data;
          console.log('✅ Tree data loaded from JSON:', data.fields.length, 'fields');
          return data;
        }
      }
      
      throw new Error('No valid tree data found');
    } catch (error) {
      console.error('Failed to load tree data:', error);
      return { fields: [] };
    }
  }

  // Unified children accessor
  function getChildren(node) {
    if (!node) return [];
    return [
      ...(node.categories || []),
      ...(node.subcategories || []),
      ...(node.nodes || []),
      ...(node.subnodes || []),
      ...(node.leafnodes || [])
    ];
  }

  // Error Boundary Component
  class TreeErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
      console.error('TreeScreen Error:', error, errorInfo);
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
          }, 'The tree visualization encountered an error.'),
          React.createElement('button', {
            key: 'reload',
            className: 'primary-button',
            onClick: () => window.location.reload()
          }, 'Reload Page')
        ]);
      }
      return this.props.children;
    }
  }

  // Simple Tree Node Component
  function TreeNode({ node, level = 0, onExpand, onSelect, expanded = false }) {
    if (!node) return null;

    const children = getChildren(node);
    const hasChildren = children.length > 0;
    const isExpanded = expanded && hasChildren;

    return React.createElement('div', {
      className: 'tree-node',
      style: {
        marginLeft: `${level * 20}px`,
        marginBottom: '0.5rem'
      }
    }, [
      React.createElement('div', {
        key: 'content',
        className: `tree-node-content ${isExpanded ? 'tree-node-content--expanded' : ''}`,
        style: {
          padding: '0.75rem',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        },
        onClick: () => {
          if (hasChildren) {
            onExpand(node.id);
          } else {
            onSelect(node);
          }
        },
        onMouseEnter: (e) => {
          e.target.style.background = 'rgba(59, 130, 246, 0.2)';
          e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
        },
        onMouseLeave: (e) => {
          e.target.style.background = 'rgba(15, 23, 42, 0.8)';
          e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
        }
      }, [
        React.createElement('div', {
          key: 'header',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }
        }, [
          React.createElement('div', {
            key: 'title',
            style: {
              fontWeight: '600',
              color: '#f7f9ff',
              fontSize: '0.95rem'
            }
          }, node.name),
          hasChildren && React.createElement('span', {
            key: 'indicator',
            style: {
              color: '#94a3b8',
              fontSize: '0.8rem'
            }
          }, isExpanded ? '−' : '+')
        ]),
        node.description && React.createElement('div', {
          key: 'description',
          style: {
            color: '#94a3b8',
            fontSize: '0.85rem',
            marginTop: '0.25rem',
            lineHeight: '1.4'
          }
        }, node.description.substring(0, 100) + (node.description.length > 100 ? '...' : '')),
        (node.tags && node.tags.length > 0) && React.createElement('div', {
          key: 'tags',
          style: { marginTop: '0.5rem' }
        }, node.tags.slice(0, 3).map(tag =>
          React.createElement('span', {
            key: tag,
            style: {
              display: 'inline-block',
              background: 'rgba(148, 163, 184, 0.2)',
              color: '#94a3b8',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              marginRight: '0.25rem'
            }
          }, tag)
        ))
      ]),
      
      // Render children if expanded
      isExpanded && React.createElement('div', {
        key: 'children',
        style: { marginTop: '0.5rem' }
      }, children.map(child =>
        React.createElement(TreeNode, {
          key: child.id,
          node: child,
          level: level + 1,
          onExpand,
          onSelect,
          expanded: expanded
        })
      ))
    ]);
  }

  // Main TreeScreen Component
  function TreeScreen({ tree, onOpenArticle, bookmarksApi }) {
    const [localTree, setLocalTree] = useState(tree || { fields: [] });
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(!tree || !tree.fields || tree.fields.length === 0);
    const [error, setError] = useState(null);

    // Load tree data on mount if not provided
    useEffect(() => {
      if (!tree || !tree.fields || tree.fields.length === 0) {
        setLoading(true);
        loadTreeData()
          .then(data => {
            setLocalTree(data);
            setLoading(false);
            // Update global tree data
            window.cryptoHustleTree = data;
          })
          .catch(err => {
            setError(err.message);
            setLoading(false);
          });
      } else {
        setLocalTree(tree);
        setLoading(false);
      }
    }, [tree]);

    // Handle node expansion
    const handleExpand = useCallback((nodeId) => {
      setExpandedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) {
          newSet.delete(nodeId);
        } else {
          newSet.add(nodeId);
        }
        return newSet;
      });
    }, []);

    // Handle node selection
    const handleSelect = useCallback((node) => {
      if (onOpenArticle) {
        onOpenArticle(node);
      }
    }, [onOpenArticle]);

    // Flatten tree for search
    const flatNodes = useMemo(() => {
      if (!localTree || !localTree.fields) return [];
      
      const flatten = (nodes, path = []) => {
        const result = [];
        nodes.forEach(node => {
          const currentPath = [...path, node.name];
          result.push({ ...node, path: currentPath });
          const children = getChildren(node);
          if (children.length > 0) {
            result.push(...flatten(children, currentPath));
          }
        });
        return result;
      };
      
      return flatten(localTree.fields);
    }, [localTree]);

    // Filter nodes based on search
    const filteredNodes = useMemo(() => {
      if (!search.trim()) return [];
      
      const query = search.toLowerCase();
      return flatNodes.filter(node =>
        node.name.toLowerCase().includes(query) ||
        (node.description && node.description.toLowerCase().includes(query)) ||
        (node.tags && node.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }, [flatNodes, search]);

    // Loading state
    if (loading) {
      return React.createElement('div', {
        className: 'screen',
        style: { padding: '2rem', textAlign: 'center' }
      }, [
        React.createElement('h2', { key: 'title' }, 'Loading Tree...'),
        React.createElement('div', {
          key: 'spinner',
          style: {
            width: '40px',
            height: '40px',
            border: '4px solid rgba(148, 163, 184, 0.3)',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '1rem auto'
          }
        }),
        React.createElement('p', {
          key: 'desc',
          style: { color: '#94a3b8' }
        }, 'Loading crypto knowledge tree...')
      ]);
    }

    // Error state
    if (error) {
      return React.createElement('div', {
        className: 'screen',
        style: { padding: '2rem', textAlign: 'center' }
      }, [
        React.createElement('h2', {
          key: 'title',
          style: { color: '#ef4444' }
        }, 'Error Loading Tree'),
        React.createElement('p', {
          key: 'desc',
          style: { color: '#94a3b8', marginBottom: '1rem' }
        }, error),
        React.createElement('button', {
          key: 'retry',
          className: 'primary-button',
          onClick: () => window.location.reload()
        }, 'Retry')
      ]);
    }

    // Empty state
    if (!localTree.fields || localTree.fields.length === 0) {
      return React.createElement('div', {
        className: 'screen',
        style: { padding: '2rem', textAlign: 'center' }
      }, [
        React.createElement('h2', { key: 'title' }, 'No Tree Data'),
        React.createElement('p', {
          key: 'desc',
          style: { color: '#94a3b8' }
        }, 'No tree data available to display.'),
        React.createElement('button', {
          key: 'reload',
          className: 'primary-button',
          onClick: () => window.location.reload()
        }, 'Reload')
      ]);
    }

    return React.createElement('div', {
      className: 'screen',
      style: { padding: '1rem' }
    }, [
      // Search bar
      React.createElement('div', {
        key: 'search-bar',
        style: { marginBottom: '1.5rem' }
      }, [
        React.createElement('input', {
          key: 'search-input',
          type: 'text',
          placeholder: 'Search the crypto knowledge tree...',
          value: search,
          onChange: (e) => setSearch(e.target.value),
          style: {
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '8px',
            color: '#f7f9ff',
            fontSize: '0.95rem'
          }
        })
      ]),

      // Content area
      React.createElement('div', {
        key: 'content',
        style: {
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'auto'
        }
      }, [
        // Search results
        search.trim() ? React.createElement('div', { key: 'search-results' }, [
          React.createElement('h3', {
            key: 'results-title',
            style: { marginBottom: '1rem', fontSize: '1.1rem' }
          }, `Search Results (${filteredNodes.length})`),
          filteredNodes.length === 0 ? 
            React.createElement('p', {
              key: 'no-results',
              style: { color: '#94a3b8' }
            }, 'No matches found.') :
            React.createElement('div', { key: 'results-list' },
              filteredNodes.map(node =>
                React.createElement('div', {
                  key: node.id,
                  style: {
                    padding: '1rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    marginBottom: '0.5rem',
                    cursor: 'pointer'
                  },
                  onClick: () => handleSelect(node)
                }, [
                  React.createElement('div', {
                    key: 'name',
                    style: { fontWeight: '600', marginBottom: '0.25rem' }
                  }, node.name),
                  React.createElement('div', {
                    key: 'path',
                    style: { color: '#94a3b8', fontSize: '0.85rem' }
                  }, node.path ? node.path.join(' / ') : ''),
                  bookmarksApi && React.createElement('button', {
                    key: 'bookmark',
                    className: `bookmark-toggle ${bookmarksApi.isBookmarked(node.id) ? 'bookmark-toggle--active' : ''}`,
                    onClick: (e) => {
                      e.stopPropagation();
                      bookmarksApi.toggleBookmark(node);
                    },
                    style: { marginTop: '0.5rem' }
                  }, bookmarksApi.isBookmarked(node.id) ? 'Bookmarked' : 'Bookmark')
                ])
              )
            )
        ]) :
        
        // Tree view
        React.createElement('div', { key: 'tree-view' }, [
          React.createElement('h3', {
            key: 'tree-title',
            style: { marginBottom: '1rem', fontSize: '1.1rem' }
          }, 'Crypto Knowledge Tree'),
          React.createElement('div', { key: 'tree-nodes' },
            localTree.fields.map(field =>
              React.createElement(TreeNode, {
                key: field.id,
                node: field,
                level: 0,
                onExpand: handleExpand,
                onSelect: handleSelect,
                expanded: expandedIds.has(field.id)
              })
            )
          )
        ])
      ])
    ]);
  }

  // Wrapped TreeScreen with Error Boundary
  function SafeTreeScreen(props) {
    return React.createElement(TreeErrorBoundary, null,
      React.createElement(TreeScreen, props)
    );
  }

  // Register component globally
  window.TreeScreen = SafeTreeScreen;
  console.log('✅ TreeScreen-final loaded successfully');

  // Add CSS for animations
  if (!document.getElementById('tree-screen-styles')) {
    const style = document.createElement('style');
    style.id = 'tree-screen-styles';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .tree-node-content {
        transition: all 0.2s ease;
      }
      
      .tree-node-content:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
      
      .bookmark-toggle {
        padding: 0.25rem 0.75rem;
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid rgba(59, 130, 246, 0.5);
        color: #60a5fa;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        transition: all 0.2s ease;
      }
      
      .bookmark-toggle:hover {
        background: rgba(59, 130, 246, 0.3);
      }
      
      .bookmark-toggle--active {
        background: rgba(16, 185, 129, 0.2);
        border-color: rgba(16, 185, 129, 0.5);
        color: #10b981;
      }
    `;
    document.head.appendChild(style);
  }

})();