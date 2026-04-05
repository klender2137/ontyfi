// tree-components.js - TreeTile and CurvedConnection components
if (typeof window !== 'undefined' && window.React) {
  const { memo } = React;

  window.TreeComponents = {
    TreeTile: ({ node, position, isExpanded, onMouseDown, onClick, onOpen, onRightClick, level, childrenCount, hasNotes, onThemeChange, onCopyLink, nodeTheme }) => {
      if (!node || !position) return null;

      // fetch description client‑side if it wasn't resolved server‑side
      const [fetchedDesc, setFetchedDesc] = React.useState('');
      const [hoveredNote, setHoveredNote] = React.useState(false);
      const [expandedNote, setExpandedNote] = React.useState(false);
      const [notes, setNotes] = React.useState([]);
      
      React.useEffect(() => {
        if (!node.description && node.descriptionRef) {
          const url = `/api/tree/description/${encodeURIComponent(node.descriptionRef)}`;
          fetch(url)
            .then(res => {
              if (!res.ok) throw new Error('status '+res.status);
              return res.text();
            })
            .catch(() => {
              // fallback to static file path when api not available
              return fetch('/' + node.descriptionRef).then(r => r.ok ? r.text() : '');
            })
            .then(text => {
              if (text) {
                // Extract clean description content
                const cleanDescription = extractCleanDescription(text);
                setFetchedDesc(cleanDescription);
              }
            })
            .catch(() => {});
        }
        
        // Load notes for this node
        try {
          const stored = localStorage.getItem('cryptoExplorer.v2.notes');
          const allNotes = stored ? JSON.parse(stored) : [];
          const nodeNotes = allNotes.filter(n => n.sectionId === node.id);
          setNotes(nodeNotes);
        } catch (error) {
          console.error('Failed to load notes:', error);
        }
        
        // Listen for storage changes to update notes in real-time
        const handleStorageChange = (e) => {
          if (e.key === 'cryptoExplorer.v2.notes') {
            try {
              const stored = e.newValue || localStorage.getItem('cryptoExplorer.v2.notes');
              const allNotes = stored ? JSON.parse(stored) : [];
              const nodeNotes = allNotes.filter(n => n.sectionId === node.id);
              setNotes(nodeNotes);
            } catch (error) {
              console.error('Failed to update notes:', error);
            }
          }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // Custom event listener for same-tab updates
        window.addEventListener('notesUpdated', handleStorageChange);
        
        return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('notesUpdated', handleStorageChange);
        };
      }, [node.description, node.descriptionRef, node.id]);

      // Extract clean description content (remove headers, section names, ## symbols)
      const extractCleanDescription = (content) => {
        if (!content) return '';
        
        const lines = content.split('\n');
        const filtered = [];
        let skippingTags = false;
        let skippingDescription = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          
          // drop top‑level title and metadata lines
          if (/^#\s+/.test(line)) continue;
          if (/^\*\*ID:/i.test(line)) continue;
          if (/^\*\*Path:/i.test(line)) continue;
          if (/^\*\*Branch:/i.test(line)) continue;

          // detect and skip Description header
          if (/^##\s+Description\b/i.test(trimmedLine)) {
            skippingDescription = true;
            continue;
          }
          
          // detect tags block
          if (/^##\s+Tags\b/i.test(trimmedLine)) {
            skippingTags = true;
            skippingDescription = false; // Stop skipping description when we hit tags
            continue;
          }
          
          // if we were skipping tags and hit another header, stop skipping
          if (skippingTags && /^##\s+/i.test(trimmedLine)) {
            skippingTags = false;
            continue;
          }
          
          // skip lines while we're in the tags block
          if (skippingTags) continue;
          
          // skip the Description header line itself
          if (skippingDescription) {
            skippingDescription = false; // Only skip the header line, then start collecting
            continue;
          }

          filtered.push(line);
        }

        // Join and clean up for short description
        const cleanContent = filtered.join('\n').trim();
        
        // For short description, get just the first paragraph or first few lines
        const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());
        if (paragraphs.length > 0) {
          return paragraphs[0].replace(/\n/g, ' ').trim();
        }
        
        return cleanContent.replace(/\n/g, ' ').trim();
      };

      // Calculate tile width based on title length
      const calculateTileWidth = (title) => {
        const baseWidth = 240;
        const avgCharWidth = 10; // Increased character width for better estimation
        const maxTitleWidth = 300; // Increased maximum width for title area
        const titleWidth = Math.min(title.length * avgCharWidth, maxTitleWidth);
        const padding = 50; // Increased padding
        const calculatedWidth = Math.max(baseWidth, titleWidth + padding);
        console.log('Tile width calculation:', { title, titleLength: title.length, titleWidth, calculatedWidth });
        return calculatedWidth;
      };
      
      const tileWidth = calculateTileWidth(node.name || '');
      
      const getShortDescription = (description) => {
        if (!description) return '';
        // Description is already cleaned by extractCleanDescription
        const cleanText = description.replace(/\s+/g, ' ').trim();
        // allow longer previews now that we load actual markdown
        const maxChars = 150;
        if (cleanText.length <= maxChars) return cleanText;
        return cleanText.substring(0, maxChars) + '...';
      };
      
      // Fix Problem 6: Handle both description and descriptionRef
      let displayDescription = node.description || fetchedDesc;
      if (!displayDescription && node.descriptionRef) {
        // still nothing? show friendly loading message
        const refName = node.descriptionRef.replace(/^.*\//, '').replace('.md', '').replace(/_/g, ' ');
        displayDescription = `Loading: ${refName}...`;
      }
      const shortDesc = getShortDescription(displayDescription);
      return React.createElement('div', {
        className: `tree-section-tile tree-section-tile--theme-${nodeTheme} ${isExpanded ? 'tree-section-tile--active' : ''} ${hasNotes ? 'tree-section-tile--has-notes' : ''}`,
        'data-node-id': node.id,
        style: { position: 'absolute', transform: `translate3d(${position.x}px, ${position.y}px, 0)`, zIndex: level, cursor: 'grab', width: `${tileWidth}px`, height: '120px', borderRadius: '8px', overflow: 'visible', willChange: 'transform', display: 'flex', flexDirection: 'column' },
        onMouseDown: (e) => { if (e.target.closest('select, button, .theme-selector, .copy-link-btn, .notes-interactive')) return; onMouseDown && onMouseDown(e, node); },
        onClick: (e) => { if (e.target.closest('select, button, .theme-selector, .copy-link-btn, .tree-section-title, .notes-interactive')) return; onClick && onClick(node); },
        onDoubleClick: (e) => { if (e.target.closest('select, button, .theme-selector, .copy-link-btn, .tree-section-title, .notes-interactive')) return; onClick && onClick(node); },
        onContextMenu: (e) => onRightClick && onRightClick(e, node)
      }, [
        React.createElement('div', { key: 'header', className: 'tree-section-header' }, [
          React.createElement('div', { key: 'title', className: 'tree-section-title', onClick: (e) => { e.stopPropagation(); onOpen && onOpen(node); }, style: { cursor: 'pointer' } }, node.name),
          // Display hierarchical path from root branch to this tile
          node.pathString && React.createElement('div', { 
            key: 'path', 
            className: 'tree-section-path',
            style: { 
              fontSize: '0.65rem', 
              color: '#64748b', 
              marginTop: '0.15rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            },
            title: node.pathString
          }, node.pathString),
          shortDesc && React.createElement('div', { key: 'description', className: 'tree-section-description' }, shortDesc)
        ]),
        React.createElement('div', { key: 'meta', className: 'tree-section-meta' }, [
          ...(node.tags || []).slice(0, 2).map(tag => React.createElement('span', { key: tag, className: 'tag-pill' }, tag)),
          React.createElement('select', { key: 'theme-selector', className: 'theme-selector', value: nodeTheme, onChange: (e) => { e.stopPropagation(); onThemeChange && onThemeChange(node.id, e.target.value); }, onMouseDown: (e) => e.stopPropagation(), onFocus: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation(), title: 'Select theme for this branch' }, [
            React.createElement('option', { key: 'default', value: 'default' }, 'Default'),
            React.createElement('option', { key: 'blue', value: 'blue' }, 'Blue'),
            React.createElement('option', { key: 'green', value: 'green' }, 'Green'),
            React.createElement('option', { key: 'purple', value: 'purple' }, 'Purple'),
            React.createElement('option', { key: 'orange', value: 'orange' }, 'Orange')
          ]),
          React.createElement('button', { key: 'copy-link', className: 'copy-link-btn', onClick: (e) => { e.stopPropagation(); onCopyLink && onCopyLink(node.id); }, style: { background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', color: '#60a5fa', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '0.25rem' }, title: 'Copy link to this block' }, '🔗'),
          childrenCount > 0 && React.createElement('span', { key: 'indicator', className: 'tree-expand-indicator' }, isExpanded ? '−' : '+')
        ]),
        
        // Interactive Notes Element - Half-hidden prestigious design
        notes.length > 0 && React.createElement('div', {
          key: 'notes-interactive',
          className: 'notes-interactive',
          style: {
            position: 'absolute',
            left: '-30px', // Hidden under tile on the left (60px width, -30px = 50% hidden)
            top: '50%',
            transform: 'translateY(-50%)',
            width: hoveredNote ? '280px' : '60px', // Expand width on hover
            height: hoveredNote ? 'auto' : '84px', // 70% of tile height, expand when hovered
            minHeight: '84px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '12px',
            padding: hoveredNote ? '16px' : '12px',
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            zIndex: 15,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: hoveredNote ? 'flex-start' : 'center',
            alignItems: hoveredNote ? 'flex-start' : 'center',
            boxShadow: hoveredNote ? 
              '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
              '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            transform: hoveredNote ? 'translateY(-50%) translateX(-15px)' : 'translateY(-50%)', // Move left when hovered
            minWidth: '60px'
          },
          onMouseEnter: () => setHoveredNote(true),
          onMouseLeave: () => {
            setHoveredNote(false);
            setTimeout(() => setExpandedNote(false), 300); // Delay collapse for smooth UX
          },
          onClick: (e) => {
            e.stopPropagation();
            setExpandedNote(!expandedNote);
          }
        }, [
          // Icon and count (collapsed state)
          !hoveredNote && React.createElement('div', {
            key: 'notes-icon-collapsed',
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }
          }, [
            React.createElement('div', {
              key: 'icon',
              style: {
                fontSize: '18px',
                opacity: 0.8,
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
              }
            }, '📝'),
            React.createElement('div', {
              key: 'count',
              style: {
                fontSize: '11px',
                fontWeight: '600',
                color: '#cbd5e1',
                opacity: 0.9,
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
              }
            }, notes.length.toString())
          ]),
          
          // Expanded content (hover state)
          hoveredNote && React.createElement('div', {
            key: 'notes-expanded',
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              width: '100%',
              opacity: expandedNote ? 1 : 0.7,
              transition: 'opacity 0.3s ease'
            }
          }, [
            // Header
            React.createElement('div', {
              key: 'header',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                paddingBottom: '8px',
                marginBottom: '4px'
              }
            }, [
              React.createElement('div', {
                key: 'title',
                style: {
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }
              }, [
                React.createElement('span', { key: 'icon', style: { fontSize: '14px' } }, '📝'),
                React.createElement('span', { key: 'text' }, 'Notes')
              ]),
              React.createElement('div', {
                key: 'badge',
                style: {
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  minWidth: '18px',
                  textAlign: 'center'
                }
              }, notes.length.toString())
            ]),
            
            // Notes content
            React.createElement('div', {
              key: 'content',
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: expandedNote ? '200px' : '60px',
                overflow: expandedNote ? 'auto' : 'hidden',
                transition: 'max-height 0.3s ease'
              }
            }, [
              ...notes.slice(0, expandedNote ? notes.length : 1).map((note, index) => 
                React.createElement('div', {
                  key: note.id,
                  style: {
                    fontSize: '11px',
                    color: '#94a3b8',
                    lineHeight: '1.5',
                    padding: '8px 10px',
                    background: 'rgba(30, 41, 59, 0.6)',
                    borderRadius: '8px',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderLeft: '3px solid #3b82f6',
                    position: 'relative',
                    overflow: 'hidden'
                  }
                }, [
                  React.createElement('div', {
                    key: 'note-text',
                    style: {
                      wordBreak: 'break-word',
                      marginBottom: '4px',
                      color: '#e2e8f0',
                      fontSize: '12px'
                    }
                  }, note.text.length > (expandedNote ? 200 : 80) ? 
                    note.text.substring(0, expandedNote ? 200 : 80) + '...' : 
                    note.text),
                  React.createElement('div', {
                    key: 'note-meta',
                    style: {
                      fontSize: '9px',
                      color: '#64748b',
                      fontStyle: 'italic',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }
                  }, [
                    React.createElement('span', { key: 'date' }, new Date(note.createdAt).toLocaleDateString()),
                    React.createElement('span', { 
                      key: 'time', 
                      style: { opacity: 0.7 } 
                    }, new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
                  ])
                ])
              ),
              
              // More notes indicator
              !expandedNote && notes.length > 1 && React.createElement('div', {
                key: 'more-indicator',
                style: {
                  fontSize: '10px',
                  color: '#64748b',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  padding: '4px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '6px',
                  border: '1px dashed rgba(59, 130, 246, 0.3)',
                  cursor: 'pointer'
                },
                onClick: (e) => {
                  e.stopPropagation();
                  setExpandedNote(true);
                }
              }, `+${notes.length - 1} more note${notes.length - 1 > 1 ? 's' : ''}`)
            ]),
            
            // Expand/Collapse hint
            React.createElement('div', {
              key: 'hint',
              style: {
                fontSize: '9px',
                color: '#64748b',
                textAlign: 'center',
                fontStyle: 'italic',
                opacity: 0.6,
                borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                paddingTop: '6px',
                marginTop: '4px'
              }
            }, expandedNote ? 'Click to collapse' : 'Click to expand all')
          ])
        ])
      ]);
    },

    CurvedConnection: memo(({ from, to, theme }) => {
      if (!from || !to) return null;
      const dx = to.x - from.x, dy = to.y - from.y;
      let fromPoint, toPoint;
      if (Math.abs(dx) > Math.abs(dy)) {
        fromPoint = { x: from.x + (dx > 0 ? 90 : -90), y: from.y };
        toPoint = { x: to.x + (dx > 0 ? -90 : 90), y: to.y };
      } else {
        fromPoint = { x: from.x, y: from.y + (dy > 0 ? 50 : -50) };
        toPoint = { x: to.x, y: to.y + (dy > 0 ? -50 : 50) };
      }
      const controlOffset = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.3, 80);
      const control1X = fromPoint.x + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? controlOffset : -controlOffset) : 0);
      const control1Y = fromPoint.y + (Math.abs(dx) <= Math.abs(dy) ? (dy > 0 ? controlOffset : -controlOffset) : 0);
      const control2X = toPoint.x + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? -controlOffset : controlOffset) : 0);
      const control2Y = toPoint.y + (Math.abs(dx) <= Math.abs(dy) ? (dy > 0 ? -controlOffset : controlOffset) : 0);
      const strokeColor = { default: 'rgba(56, 189, 248, 0.6)', blue: 'rgba(59, 130, 246, 0.7)', green: 'rgba(34, 197, 94, 0.7)', purple: 'rgba(168, 85, 247, 0.7)', orange: 'rgba(251, 146, 60, 0.7)' }[theme] || 'rgba(56, 189, 248, 0.6)';
      return React.createElement('svg', { key: `connection-${from.id}-${to.id}`, style: { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 } }, [
        React.createElement('path', { key: 'path', d: `M ${fromPoint.x} ${fromPoint.y} C ${control1X} ${control1Y} ${control2X} ${control2Y} ${toPoint.x} ${toPoint.y}`, stroke: strokeColor, strokeWidth: '3', fill: 'none', opacity: '0.9', strokeLinecap: 'round' })
      ]);
    })
  };
}
