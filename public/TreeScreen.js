// TreeScreen.js - Main orchestrator
console.log('TreeScreen.js: Starting to load...');

if (typeof window !== 'undefined' && window.React) {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  if (!window.cryptoHustleTree) {
    fetch('/api/tree').then(res => res.json()).then(data => {
      if (data && data.fields) window.cryptoHustleTree = data;
    }).catch(() => { window.cryptoHustleTree = { fields: [] }; });
  }

  class TreeErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(error, errorInfo) { console.error('TreeScreen error:', error, errorInfo); }
    render() {
      if (this.state.hasError) {
        return React.createElement('div', { className: 'screen', style: { padding: '2rem', textAlign: 'center' } }, [
          React.createElement('h2', { key: 'title', style: { color: '#ef4444', marginBottom: '1rem' } }, 'Tree View Error'),
          React.createElement('p', { key: 'desc', style: { color: '#94a3b8', marginBottom: '1rem' } }, 'Something went wrong.'),
          React.createElement('button', { key: 'btn', className: 'primary-button', onClick: () => window.location.reload() }, 'Reload')
        ]);
      }
      return this.props.children;
    }
  }

  function TreeScreen({ tree, onOpenArticle, bookmarksApi, onGoHome }) {
    if (!tree || !tree.fields || !Array.isArray(tree.fields) || tree.fields.length === 0) {
      return React.createElement('div', { className: 'screen', style: { padding: '2rem', textAlign: 'center' } }, [
        React.createElement('div', { key: 'text', className: 'secondary-text' }, 'No tree data available'),
        React.createElement('button', { key: 'btn', className: 'primary-button', onClick: () => window.location.reload() }, 'Reload')
      ]);
    }

    const [expandedIds, setExpandedIds] = window.TreeHooks.useExpansionState();
    const [nodePositions, setNodePositions] = useState({});
    const [draggedNodeId, setDraggedNodeId] = useState(null);
    const [draggedNodePositions, setDraggedNodePositions] = useState({}); // Track dragged positions
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [viewState, setViewState] = useState({ zoom: 1, panOffset: { x: 0, y: 0 } });
    const { zoom, panOffset } = viewState;
    const [isPanning, setIsPanning] = useState(false);
    const [nodeThemes, setNodeThemes] = useState(() => {
      try { return JSON.parse(localStorage.getItem('cryptoExplorer.nodeThemes')) || {}; } catch { return {}; }
    });
    const [treeVersion, setTreeVersion] = useState(0);
    const [justExpanded, setJustExpanded] = useState(new Set());
    const [hasInitiallyPositioned, setHasInitiallyPositioned] = useState(false);
    const { notes, addNote, deleteNote } = window.TreeHooks.useNotes();
    const dragInfo = useRef({ startX: 0, startY: 0, initialNodeX: 0, initialNodeY: 0 });
    const panInfo = useRef({ startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });
    const containerRef = useRef(null);

    const getChildren = window.TreeUtils.getChildren;
    const { TreeTile, CurvedConnection } = window.TreeComponents;
    const themeManager = window.TreeUtils.createThemeManager(nodeThemes, setNodeThemes);

    const nodePositionsRef = useRef(nodePositions);
    const zoomRef = useRef(zoom);
    const panOffsetRef = useRef(panOffset);
    useEffect(() => {
      nodePositionsRef.current = nodePositions;
      zoomRef.current = zoom;
      panOffsetRef.current = panOffset;
    });

    const centerOnNode = window.TreeNavigation.createCenterOnNode(nodePositionsRef, zoomRef, panOffsetRef, setViewState, containerRef);
    const expandToNode = useCallback(window.TreeNavigation.createExpandToNode(tree, setExpandedIds, centerOnNode, getChildren, setTreeVersion), [tree, setExpandedIds, centerOnNode, setTreeVersion]);

    // Expose helper for AutoUnfold/TreeNavigation to re-seed child positions with controlled randomness
    useEffect(() => {
      window.TreeScreenReseedChildren = (parentId) => {
        try {
          if (!parentId) return false;
          const parentPos = nodePositionsRef.current?.[parentId];
          if (!parentPos) return false;

          // Find parent node in the tree
          const findNode = (nodes, targetId) => {
            if (!Array.isArray(nodes)) return null;
            for (const node of nodes) {
              if (!node || !node.id) continue;
              if (node.id === targetId) return node;
              const children = getChildren(node);
              const found = findNode(children, targetId);
              if (found) return found;
            }
            return null;
          };

          const parentNode = findNode(tree.fields, parentId);
          if (!parentNode) return false;
          const children = getChildren(parentNode);
          if (!children || children.length === 0) return false;

          const newChildPositions = window.TreeSmartLayout.calculateChildPositions(
            parentPos,
            children,
            nodePositionsRef.current || {},
            expandedIds
          );

          setNodePositions(prev => ({ ...prev, ...newChildPositions }));
          return true;
        } catch (e) {
          console.warn('TreeScreen: TreeScreenReseedChildren failed:', e);
          return false;
        }
      };

      return () => {
        window.TreeScreenReseedChildren = null;
      };
    }, [tree, expandedIds, getChildren]);

    useEffect(() => {
      if (Object.keys(nodePositions).length === 0 || hasInitiallyPositioned) return;
      
      // Add delay to ensure tree is fully rendered
      const positionTimer = setTimeout(() => {
        const positions = Object.values(nodePositions);
        if (positions.length === 0) return;
        
        const centerX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length;
        const centerY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
        const containerRect = containerRef.current?.getBoundingClientRect();
        
        if (containerRect) {
          console.log('TreeScreen: Centering view on tree centroid:', { centerX, centerY });
          setViewState(prev => ({ 
            ...prev, 
            panOffset: { 
              x: containerRect.width / 2 - centerX, 
              y: containerRect.height / 2 - centerY 
            } 
          }));
          setHasInitiallyPositioned(true);
        }
      }, 300); // Increased delay for better reliability
      
      return () => clearTimeout(positionTimer);
    }, [nodePositions, hasInitiallyPositioned]);

    useEffect(() => {
      if (!tree || !tree.fields) return;
      
      // Use smart layout for initial calculation
      const newPositions = window.TreeSmartLayout.calculatePositions(tree, expandedIds, getChildren, nodePositions);
      setNodePositions(newPositions);
    }, [expandedIds, tree, treeVersion]);

    const handleWheel = useCallback((e) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setViewState(prev => {
        const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
        const worldX = (mouseX - prev.panOffset.x) / prev.zoom, worldY = (mouseY - prev.panOffset.y) / prev.zoom;
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(3, prev.zoom * factor));
        return { zoom: newZoom, panOffset: { x: mouseX - worldX * newZoom, y: mouseY - worldY * newZoom } };
      });
    }, []);

    const handlePanStart = useCallback((e) => {
      if (draggedNodeId || e.target.closest('.tree-section-tile')) return;
      setIsPanning(true);
      panInfo.current = { startX: e.clientX, startY: e.clientY, initialPanX: panOffset.x, initialPanY: panOffset.y };
    }, [draggedNodeId, panOffset]);

    const handleMouseMove = useCallback((e) => {
      if (draggedNodeId && dragInfo.current) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const deltaScreenX = e.clientX - dragInfo.current.startX, deltaScreenY = e.clientY - dragInfo.current.startY;
        const deltaWorldX = deltaScreenX / zoom, deltaWorldY = deltaScreenY / zoom;
        const newPos = { x: dragInfo.current.initialNodeX + deltaWorldX, y: dragInfo.current.initialNodeY + deltaWorldY };
        
        // Update both the main positions and track dragged positions
        setNodePositions(prev => ({ ...prev, [draggedNodeId]: newPos }));
        setDraggedNodePositions(prev => ({ ...prev, [draggedNodeId]: newPos }));
        
        // DON'T update children positions during drag - this is the key fix
      } else if (isPanning && panInfo.current) {
        const deltaX = e.clientX - panInfo.current.startX, deltaY = e.clientY - panInfo.current.startY;
        setViewState(prev => ({ ...prev, panOffset: { x: panInfo.current.initialPanX + deltaX, y: panInfo.current.initialPanY + deltaY } }));
      }
    }, [draggedNodeId, isPanning, zoom, expandedIds, tree]);

    const handleMouseDown = useCallback((e, node) => {
      if (!node || !node.id) return;
      e.stopPropagation();
      const pos = nodePositions[node.id];
      if (!pos) return;
      setDraggedNodeId(node.id);
      dragInfo.current = { startX: e.clientX, startY: e.clientY, initialNodeX: pos.x, initialNodeY: pos.y };
    }, [nodePositions]);

    const handleMouseUp = useCallback(() => { setDraggedNodeId(null); setIsPanning(false); }, []);

    const handleTileClick = useCallback((node) => {
      if (!node || !node.id) return;
      
      // Track view history when opening/viewing a tile
      if (window.SearchBar?.addToViewHistory) {
        const nodePath = node.fullPath || node.pathString || '';
        // Handle nodePath safely - ensure it's a string before splitting
        const pathStr = Array.isArray(nodePath) ? nodePath.join(' / ') : (typeof nodePath === 'string' ? nodePath : String(nodePath || ''));
        const pathArray = pathStr ? pathStr.split(' / ') : [];
        window.SearchBar.addToViewHistory(node.id, node.name, pathArray);
      }
      
      const newExpanded = new Set(expandedIds);
      const wasExpanded = newExpanded.has(node.id);
      
      if (wasExpanded) {
        // Folding - remove from expanded
        newExpanded.delete(node.id);
        const descendantsToCollapse = window.TreeLayout.collapseDescendants(node.id, newExpanded, tree, getChildren);
        descendantsToCollapse.forEach(id => newExpanded.delete(id));
      } else {
        // Expanding - add to expanded and use smart layout for children
        newExpanded.add(node.id);
        
        // Get parent position (use dragged position if available)
        const parentPos = draggedNodePositions[node.id] || nodePositions[node.id];
        
        if (parentPos) {
          // Use TreeSmartLayout for intelligent child positioning
          const children = getChildren(node);
          const smartPositions = window.TreeSmartLayout.calculateChildPositions(
            parentPos,
            children,
            nodePositions,
            newExpanded
          );
          
          const updatedPositions = { ...nodePositions, ...smartPositions };
          setNodePositions(updatedPositions);
        }
      }
      
      setExpandedIds(newExpanded);
      setJustExpanded(new Set());
    }, [expandedIds, setExpandedIds, tree, nodePositions, draggedNodePositions]);

    const handleAddNote = useCallback(() => {
      if (noteText.trim() && selectedNodeId) {
        addNote(selectedNodeId, noteText.trim());
        setNoteText('');
        setShowNotes(false);
        
        // Dispatch custom event to update interactive notes elements
        window.dispatchEvent(new CustomEvent('notesUpdated', {
          detail: { sectionId: selectedNodeId }
        }));
      }
    }, [noteText, selectedNodeId, addNote]);

    const handleNodeRightClick = useCallback((e, node) => {
      e.preventDefault();
      setSelectedNodeId(node.id);
      setShowNotes(true);
    }, []);

    const flatNodes = useMemo(() => window.TreeUtils.flattenTree(tree, getChildren), [tree]);
    
    // Search handlers
    const handleSearch = React.useCallback((query, results) => {
      setSearch(query);
      setSearchResults(results);
      setShowSearchResults(true);
    }, []);
    
    const handleResultSelect = React.useCallback((node) => {
      console.log('TreeScreen: handleResultSelect called for node:', node?.id, node?.name);
      if (!node || !node.id) {
        console.warn('TreeScreen: Invalid node provided to handleResultSelect');
        return;
      }
      
      // Track tile open with UserActivityTracker
      if (typeof window !== 'undefined' && window.UserActivityTracker) {
        window.UserActivityTracker.trackTileOpen(node);
      }
      
      // Ensure expandToNode is called with proper delay for state to settle
      setTimeout(() => {
        console.log('TreeScreen: Calling expandToNode for:', node.id);
        expandToNode(node.id, true);
      }, 100);
      
      // Add to search history (non-blocking)
      try {
        if (window.SearchBar && window.SearchBar.Storage) {
          const nodePath = node.fullPath || node.pathString || '';
          // Handle nodePath safely - ensure it's a string before splitting
          const pathStr = Array.isArray(nodePath) ? nodePath.join(' / ') : (typeof nodePath === 'string' ? nodePath : String(nodePath || ''));
          const pathArray = pathStr ? pathStr.split(' / ') : [];
          window.SearchBar.Storage.addToViewHistory(node.id, node.name, pathArray);
        }
      } catch (error) {
        console.warn('TreeScreen: Failed to add to view history:', error);
      }
    }, [expandToNode]);
    
    const handleClearSearch = React.useCallback(() => {
      setSearch('');
      setSearchResults([]);
      setShowSearchResults(false);
    }, []);

    const handleMouseDownRef = useRef(handleMouseDown);
    const handleTileClickRef = useRef(handleTileClick);
    const handleNodeRightClickRef = useRef(handleNodeRightClick);
    const onOpenArticleRef = useRef(onOpenArticle);
    const applyThemeToHierarchyRef = useRef(themeManager.setNodeTheme);
    const copyNodeLinkRef = useRef(themeManager.copyNodeLink);

    useEffect(() => {
      handleMouseDownRef.current = handleMouseDown;
      handleTileClickRef.current = handleTileClick;
      handleNodeRightClickRef.current = handleNodeRightClick;
      onOpenArticleRef.current = onOpenArticle;
      applyThemeToHierarchyRef.current = themeManager.setNodeTheme;
      copyNodeLinkRef.current = themeManager.copyNodeLink;
    });

    const renderRecursive = useCallback((node, level = 0) => {
      if (!node || !node.id) return null;
      const pos = nodePositions[node.id] || { x: 100 + level * 200, y: 100 + level * 120 };
      const nodeNotes = notes.filter(n => n.sectionId === node.id);
      const children = getChildren(node);
      const isExpanded = expandedIds.has(node.id);
      return React.createElement(React.Fragment, { key: node.id }, [
        React.createElement(TreeTile, { key: `tile-${node.id}`, node, position: pos, level, isExpanded, childrenCount: children.length, hasNotes: nodeNotes.length > 0, onMouseDown: handleMouseDownRef.current, onOpen: onOpenArticleRef.current, onClick: handleTileClickRef.current, onRightClick: handleNodeRightClickRef.current, onThemeChange: applyThemeToHierarchyRef.current, onCopyLink: copyNodeLinkRef.current, nodeTheme: themeManager.getNodeTheme(node.id) }),
        ...(isExpanded ? children.map(child => renderRecursive(child, level + 1)).filter(Boolean) : [])
      ]);
    }, [nodePositions, expandedIds, notes, themeManager]);

    useEffect(() => {
      const handleTreeUpdate = () => { setTreeVersion(prev => prev + 1); setNodePositions({}); setExpandedIds(new Set()); };
      const handleArticleAdded = (event) => { setTreeVersion(prev => prev + 1); setNodePositions({}); setTimeout(() => { if (event.detail.articleId) expandToNode(event.detail.articleId, true); }, 500); };
      const handleBookmarkNavigation = (event) => { 
        console.log('TreeScreen: Bookmark navigation event:', event.detail);
        if (event.detail.nodeId) {
          expandToNode(event.detail.nodeId, true);
        }
      };
      window.addEventListener('treeUpdated', handleTreeUpdate);
      window.addEventListener('articleAdded', handleArticleAdded);
      window.addEventListener('navigateToBookmark', handleBookmarkNavigation);
      return () => {
        window.removeEventListener('treeUpdated', handleTreeUpdate);
        window.removeEventListener('articleAdded', handleArticleAdded);
        window.removeEventListener('navigateToBookmark', handleBookmarkNavigation);
      };
    }, [expandToNode, setExpandedIds]);

    useEffect(() => { 
      window.TreeScreenExpandToNode = expandToNode; 
      
      // Expose tree data to AutoUnfold system
      if (window.AutoUnfold) {
        window.currentTree = tree;
        console.log('TreeScreen: Tree data exposed to AutoUnfold system');
      }
      
      return () => { 
        window.TreeScreenExpandToNode = null; 
        if (window.AutoUnfold) {
          window.currentTree = null;
        }
      }; 
    }, [expandToNode, tree]);

    return React.createElement('div', { className: 'screen', style: { padding: 0, margin: 0, height: '100vh', overflow: 'hidden', position: 'relative', background: '#0f172a' } }, [
      // Enhanced SearchBar - Floating Island Style
      React.createElement('div', { 
        key: 'search-bar-container', 
        style: { 
          position: 'absolute', 
          top: '20px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          width: 'auto',
          maxWidth: '90vw'
        } 
      }, [
        React.createElement(window.SearchBar.Component, {
          key: 'search-bar',
          onSearch: handleSearch,
          onResultSelect: handleResultSelect,
          flatNodes: flatNodes,
          placeholder: 'Search articles, paste links, or type paths...'
        })
      ]),
      showNotes && React.createElement('div', { key: 'notes-modal', className: 'notes-modal', style: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }, onClick: () => setShowNotes(false) }, [
        React.createElement('div', { key: 'modal-content', style: { background: '#1e293b', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%' }, onClick: e => e.stopPropagation() }, [
          React.createElement('h3', { key: 'title' }, 'Add Note'),
          React.createElement('textarea', { key: 'textarea', value: noteText, onChange: e => setNoteText(e.target.value), placeholder: 'Enter your note...', style: { width: '100%', height: '100px', margin: '1rem 0', padding: '0.5rem', background: '#374151', border: '1px solid #4b5563', borderRadius: '4px', color: '#f7f9ff' } }),
          React.createElement('div', { key: 'buttons', style: { display: 'flex', gap: '1rem' } }, [
            React.createElement('button', { key: 'save', onClick: handleAddNote, className: 'primary-button' }, 'Save Note'),
            React.createElement('button', { key: 'cancel', onClick: () => setShowNotes(false), className: 'secondary-button' }, 'Cancel')
          ]),
          selectedNodeId && notes.filter(n => n.sectionId === selectedNodeId).length > 0 && React.createElement('div', { key: 'existing-notes', style: { marginTop: '1rem' } }, [
            React.createElement('h4', { key: 'existing-title' }, 'Existing Notes:'),
            ...notes.filter(n => n.sectionId === selectedNodeId).map(note => React.createElement('div', { key: note.id, style: { background: '#374151', padding: '0.5rem', margin: '0.5rem 0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
              React.createElement('span', { key: 'text' }, note.text),
              React.createElement('button', { key: 'delete', onClick: () => deleteNote(note.id), style: { background: '#ef4444', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', color: 'white', cursor: 'pointer' } }, 'Delete')
            ]))
          ])
        ])
      ]),
      // Search results overlay - positioned below the floating island
      showSearchResults && searchResults.length > 0 && React.createElement('div', { 
        key: 'search-results', 
        className: 'search-results', 
        style: { 
          position: 'absolute', 
          top: '80px', 
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: 'calc(100vh - 120px)', 
          overflow: 'auto', 
          background: 'rgba(20, 25, 40, 0.95)', 
          borderRadius: '20px', 
          border: '1px solid rgba(255, 255, 255, 0.15)', 
          zIndex: 999, 
          padding: '1rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(20px)'
        } 
      }, [
        React.createElement('div', { 
          key: 'results-header',
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
          }
        }, [
          React.createElement('span', { 
            key: 'results-count',
            style: { color: '#94a3b8', fontSize: '14px' } 
          }, `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} found`),
          React.createElement('button', {
            key: 'close-results',
            onClick: handleClearSearch,
            style: {
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px 8px',
              borderRadius: '4px'
            }
          }, '✕')
        ]),
        ...searchResults.map(n => React.createElement('div', { 
          key: n.id, 
          className: 'search-result-item',
          style: {
            padding: '12px',
            marginBottom: '8px',
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          },
          onClick: () => { 
            console.log('TreeScreen: Search result clicked for:', n.id, n.name);
            
            // Add immediate visual feedback
            const targetElement = document.querySelector(`[data-node-id="${n.id}"]`);
            if (targetElement) {
              targetElement.style.transition = 'all 0.2s ease';
              targetElement.style.boxShadow = '0 8px 25px rgba(34, 197, 94, 0.5)';
              setTimeout(() => {
                targetElement.style.boxShadow = '';
              }, 200);
            }
            
            // Call expandToNode with proper delay
            setTimeout(() => {
              console.log('TreeScreen: Calling expandToNode from search results');
              expandToNode(n.id, true);
            }, 50);
            
            handleClearSearch();
            
            // Track view history with error handling
            try {
              if (window.SearchBar?.addToViewHistory) {
                const nodePath = n.fullPath || n.pathString || '';
                // Handle nodePath safely - ensure it's a string before splitting
                const pathStr = Array.isArray(nodePath) ? nodePath.join(' / ') : (typeof nodePath === 'string' ? nodePath : String(nodePath || ''));
                const pathArray = pathStr ? pathStr.split(' / ') : [];
                window.SearchBar.addToViewHistory(n.id, n.name, pathArray);
              } else if (window.SearchBar?.Storage?.addToViewHistory) {
                const nodePath = n.fullPath || n.pathString || '';
                // Handle nodePath safely - ensure it's a string before splitting
                const pathStr = Array.isArray(nodePath) ? nodePath.join(' / ') : (typeof nodePath === 'string' ? nodePath : String(nodePath || ''));
                const pathArray = pathStr ? pathStr.split(' / ') : [];
                window.SearchBar.Storage.addToViewHistory(n.id, n.name, pathArray);
              }
            } catch (error) {
              console.warn('TreeScreen: Failed to add to view history:', error);
            }
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
          }
        }, [
          React.createElement('div', { 
            key: 'name', 
            style: { 
              fontWeight: '500', 
              color: '#e2e8f0',
              marginBottom: '4px'
            } 
          }, n.name),
          React.createElement('div', { 
            key: 'path', 
            style: { 
              fontSize: '12px', 
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            } 
          }, [
            React.createElement('span', { key: 'path-text' }, n.fullPath ? (Array.isArray(n.fullPath) ? n.fullPath.join(' / ') : String(n.fullPath)) : ''),
            React.createElement('button', { 
              key: 'copy-path', 
              onClick: (e) => { 
                e.stopPropagation(); 
                const pathToCopy = n.fullPath ? (Array.isArray(n.fullPath) ? n.fullPath.join(' / ') : String(n.fullPath)) : n.name; 
                navigator.clipboard.writeText(pathToCopy).then(() => { 
                  const btn = e.target; 
                  btn.textContent = 'Copied!'; 
                  btn.style.color = '#22c55e';
                  setTimeout(() => { 
                    btn.textContent = '📋'; 
                    btn.style.color = ''; 
                  }, 1500); 
                }).catch(() => alert('Failed to copy path')); 
              }, 
              title: 'Copy path to clipboard',
              style: {
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px'
              }
            }, '📋')
          ]),
          n.description && React.createElement('div', {
            key: 'desc',
            style: {
              fontSize: '12px',
              color: '#64748b',
              marginTop: '4px'
            }
          }, n.description.length > 80 ? n.description.substring(0, 80) + '...' : n.description)
        ]))
      ]),
      // Tree visualization container
      React.createElement('div', { 
        key: 'tree-space-container', 
        ref: containerRef, 
        style: { 
          position: 'absolute', 
          top: showSearchResults && searchResults.length > 0 ? 'calc(90px + min(400px, 50vh))' : '80px', 
          left: '0', 
          right: '0', 
          bottom: '0', 
          overflow: 'hidden', 
          background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.8), rgba(5, 8, 20, 0.9))',
          transition: 'top 0.3s ease'
        }, 
        onMouseDown: handlePanStart, 
        onMouseMove: handleMouseMove, 
        onMouseUp: handleMouseUp, 
        onMouseLeave: handleMouseUp, 
        onWheel: handleWheel 
      }, [
        React.createElement('div', { 
          key: 'tree-world', 
          style: { 
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, 
            transformOrigin: '0 0', 
            position: 'absolute', 
            width: '5000px', 
            height: '5000px' 
          } 
        }, [
          // Connections layer
          React.createElement('svg', { 
            key: 'connections-layer', 
            style: { 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              pointerEvents: 'none', 
              zIndex: 1 
            } 
          }, (() => {
            const connections = [];
            const collectConnections = (nodes) => {
              nodes.forEach(node => {
                if (expandedIds.has(node.id)) {
                  const children = getChildren(node);
                  const nodePos = nodePositions[node.id];
                  if (nodePos) {
                    children.forEach(child => {
                      const childPos = nodePositions[child.id];
                      if (childPos) connections.push(React.createElement(CurvedConnection, { 
                        key: `connection-${node.id}-${child.id}`, 
                        from: nodePos, 
                        to: childPos, 
                        theme: themeManager.getNodeTheme(node.id) 
                      }));
                    });
                  }
                  collectConnections(children);
                }
              });
            };
            collectConnections(tree.fields);
            return connections;
          })()),
          // Tiles layer
          React.createElement('div', { 
            key: 'tiles-layer', 
            style: { position: 'absolute', width: '100%', height: '100%' } 
          }, tree.fields.map(field => renderRecursive(field)).filter(Boolean))
        ])
      ]),
      React.createElement('div', { key: 'zoom-controls', style: { position: 'absolute', bottom: '20px', right: '20px', zIndex: 200, display: 'flex', flexDirection: 'column', gap: '0.5rem' } }, [
        React.createElement('button', { key: 'home-btn', onClick: () => { if (onGoHome) { onGoHome(); } else { console.warn('TreeScreen: onGoHome prop not provided'); } }, style: { padding: '0.5rem', background: '#10b981', border: '1px solid #059669', borderRadius: '4px', color: '#f7f9ff', cursor: 'pointer', fontSize: '0.8rem' } }, '← Home'),
        React.createElement('button', { key: 'zoom-in', onClick: () => setViewState(prev => ({ ...prev, zoom: Math.min(3, prev.zoom * 1.2) })), style: { padding: '0.5rem', background: '#374151', border: '1px solid #4b5563', borderRadius: '4px', color: '#f7f9ff', cursor: 'pointer' } }, '+'),
        React.createElement('button', { key: 'zoom-out', onClick: () => setViewState(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom * 0.8) })), style: { padding: '0.5rem', background: '#374151', border: '1px solid #4b5563', borderRadius: '4px', color: '#f7f9ff', cursor: 'pointer' } }, '−'),
        React.createElement('button', { key: 'zoom-reset', onClick: () => { setViewState(prev => ({ ...prev, zoom: 1 })); if (!hasInitiallyPositioned) { const positions = Object.values(nodePositions); if (positions.length > 0) { const centerX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length; const centerY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length; const containerRect = containerRef.current?.getBoundingClientRect(); if (containerRect) setViewState(prev => ({ ...prev, panOffset: { x: containerRect.width / 2 - centerX, y: containerRect.height / 2 - centerY } })); } } }, style: { padding: '0.5rem', background: '#374151', border: '1px solid #4b5563', borderRadius: '4px', color: '#f7f9ff', cursor: 'pointer', fontSize: '0.8rem' } }, '⌂')
      ])
    ]);
  }

  function SafeTreeScreen(props) {
    return React.createElement(TreeErrorBoundary, null, React.createElement(TreeScreen, props));
  }

  window.TreeScreenExpandToNode = function() { console.warn('TreeScreen not yet rendered'); return false; };
  window.TreeScreen = SafeTreeScreen;
  console.log('✅ TreeScreen registered successfully');
} else {
  console.error('❌ TreeScreen.js: React not available');
}
