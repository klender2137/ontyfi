if (typeof window !== 'undefined' && window.React) {
  const { useState, useEffect } = React;

  function FavoritesScreen({ bookmarks, onOpenArticle, onGoHome, onGoToTree }) {
    const pathToString = (path) => {
      if (!Array.isArray(path)) return '';
      return path.map(p => p.name || p).join(' / ');
    };

    const handleBookmarkClick = (bookmark) => {
      onGoToTree();
      
      setTimeout(() => {
        if (window.AutoUnfold && typeof window.AutoUnfold.unfoldFromBookmark === 'function') {
          console.log('FavoritesScreen: Using AutoUnfold for bookmark navigation');
          window.AutoUnfold.unfoldFromBookmark(bookmark.id, bookmark.name || 'Bookmark');
        } else if (window.TreeScreenExpandToNode && typeof window.TreeScreenExpandToNode === 'function') {
          console.log('FavoritesScreen: Falling back to TreeScreenExpandToNode');
          window.TreeScreenExpandToNode(bookmark.id, true, { isBookmarkNavigation: true });
        } else {
          console.warn('FavoritesScreen: No navigation method available');
          window.dispatchEvent(new CustomEvent('navigateToBookmark', {
            detail: { nodeId: bookmark.id }
          }));
        }
      }, 200);
    };

    const handleLoadTreeState = async () => {
      try {
        if (!window.TreeStateSync || typeof window.TreeStateSync.load !== 'function') {
          throw new Error('Tree state sync not available');
        }
        const state = await window.TreeStateSync.load();
        onGoToTree();
        setTimeout(() => {
          try {
            if (window.TreeStateSync && typeof window.TreeStateSync.apply === 'function') {
              window.TreeStateSync.apply(state);
            }
          } catch (e) {
            alert(e?.message || 'Failed to apply tree state');
          }
        }, 250);
      } catch (e) {
        alert(e?.message || 'Failed to load tree state');
      }
    };

    const handleSaveTreeState = async () => {
      try {
        if (!window.TreeStateSync || typeof window.TreeStateSync.save !== 'function') {
          throw new Error('Tree state sync not available');
        }
        await window.TreeStateSync.save();
        alert('Tree state saved');
      } catch (e) {
        alert(e?.message || 'Failed to save tree state');
      }
    };

    return React.createElement('div', { className: 'screen' }, [
      React.createElement('div', { 
        key: 'nav', 
        className: 'nav-exit-buttons' 
      }, [
        React.createElement('button', {
          key: 'home',
          className: 'nav-exit-btn',
          onClick: onGoHome
        }, '← Home'),
        React.createElement('button', {
          key: 'tree',
          className: 'nav-exit-btn',
          onClick: onGoToTree
        }, '🌳 Tree')
      ]),
      React.createElement('h2', { 
        key: 'title',
        style: { marginTop: '1.5rem', marginBottom: '0.5rem' } 
      }, 'Favorites'),
      React.createElement('div', { 
        key: 'subtitle',
        className: 'secondary-text' 
      }, 'Bookmarked sections from your CryptoMap tree.'),
      React.createElement('div', {
        key: 'treestate-actions',
        style: { marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }
      }, [
        React.createElement('button', {
          key: 'load-state',
          className: 'secondary-button',
          onClick: handleLoadTreeState
        }, 'Load saved Tree state'),
        React.createElement('button', {
          key: 'save-state',
          className: 'secondary-button',
          onClick: handleSaveTreeState
        }, 'Save Tree state'),
      ]),
      React.createElement('div', { 
        key: 'list',
        className: 'bookmarks-list' 
      }, bookmarks.length === 0 ? 
        React.createElement('div', {
          className: 'secondary-text',
          style: { marginTop: '1rem' }
        }, 'No bookmarks yet. Use the "Bookmark" buttons in search results or articles.') :
        bookmarks.map(b => 
          React.createElement('div', {
            key: b.id,
            className: 'bookmarks-list-item',
            onClick: () => handleBookmarkClick(b)
          }, React.createElement('div', {}, [
            React.createElement('div', {
              key: 'name',
              className: 'search-result-name'
            }, b.name),
            React.createElement('div', {
              key: 'path',
              className: 'search-result-path'
            }, b.path ? pathToString(b.path) : '')
          ]))
        )
      )
    ]);
  }

  window.FavoritesScreen = FavoritesScreen;
  console.log('✅ FavoritesScreen registered');
}
