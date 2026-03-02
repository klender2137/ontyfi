// TreeScreen-minimal.js - DISABLED - Use TreeScreen-final.js instead
// This file is disabled to prevent conflicts with the new centralized implementation
if (false) {
  'use strict';
  
  console.log('Loading minimal TreeScreen...');
  
  if (typeof React === 'undefined') {
    console.error('React not available for TreeScreen');
    return;
  }
  
  function MinimalTreeScreen({ tree, onOpenArticle, bookmarksApi }) {
    console.log('MinimalTreeScreen called with:', { tree, onOpenArticle, bookmarksApi });
    
    const { useState } = React;
    const [search, setSearch] = useState('');
    
    // Validate props
    if (!tree || !tree.fields || !Array.isArray(tree.fields)) {
      return React.createElement('div', {
        className: 'screen',
        style: { padding: '2rem', textAlign: 'center' }
      }, [
        React.createElement('h2', { key: 'title' }, 'Tree Data Missing'),
        React.createElement('p', { key: 'desc' }, 'Tree data is not available or invalid'),
        React.createElement('button', {
          key: 'reload',
          className: 'primary-button',
          onClick: () => window.location.reload()
        }, 'Reload Page')
      ]);
    }
    
    if (tree.fields.length === 0) {
      return React.createElement('div', {
        className: 'screen',
        style: { padding: '2rem', textAlign: 'center' }
      }, [
        React.createElement('h2', { key: 'title' }, 'No Tree Data'),
        React.createElement('p', { key: 'desc' }, 'Tree fields array is empty'),
        React.createElement('button', {
          key: 'reload',
          className: 'primary-button',
          onClick: () => window.location.reload()
        }, 'Reload Page')
      ]);
    }
    
    // Render tree fields as simple list
    const renderField = (field, index) => {
      return React.createElement('div', {
        key: field.id || index,
        className: 'tree-section-tile',
        style: { margin: '1rem 0', cursor: 'pointer' },
        onClick: () => onOpenArticle && onOpenArticle(field)
      }, [
        React.createElement('div', {
          key: 'title',
          className: 'tree-section-title'
        }, field.name || 'Unnamed'),
        React.createElement('div', {
          key: 'desc',
          className: 'tree-section-meta'
        }, field.description || 'No description'),
        field.tags && React.createElement('div', {
          key: 'tags',
          style: { marginTop: '0.5rem' }
        }, field.tags.slice(0, 3).map(tag => 
          React.createElement('span', {
            key: tag,
            className: 'tag-pill',
            style: { marginRight: '0.5rem' }
          }, tag)
        ))
      ].filter(Boolean));
    };
    
    return React.createElement('div', {
      className: 'screen',
      style: { padding: '1rem' }
    }, [
      React.createElement('div', {
        key: 'header',
        style: { marginBottom: '2rem' }
      }, [
        React.createElement('h2', { key: 'title' }, 'CryptoExplorer Tree'),
        React.createElement('p', { key: 'desc' }, `${tree.fields.length} sections available`)
      ]),
      
      React.createElement('input', {
        key: 'search',
        className: 'search-input',
        placeholder: 'Search tree...',
        value: search,
        onChange: (e) => setSearch(e.target.value),
        style: { width: '100%', marginBottom: '1rem' }
      }),
      
      React.createElement('div', {
        key: 'content',
        style: { maxHeight: '70vh', overflow: 'auto' }
      }, tree.fields.filter(field => 
        !search || field.name?.toLowerCase().includes(search.toLowerCase()) ||
        field.description?.toLowerCase().includes(search.toLowerCase())
      ).map(renderField))
    ]);
  }
  
  // Export to window
  window.TreeScreen = MinimalTreeScreen;
  console.log('MinimalTreeScreen loaded successfully');
}