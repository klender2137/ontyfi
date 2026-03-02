// Ultra-fast initialization - no delays, no retries
(function() {
  'use strict';
  
  // Immediate start - no waiting
  if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
    startApp();
  } else {
    // Single retry after 100ms max
    setTimeout(() => {
      if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
        startApp();
      } else {
        console.error('React failed to load');
        showErrorScreen();
      }
    }, 100);
  }

  function showErrorScreen() {
    document.getElementById('root').innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #94a3b8;">
        <h3>Loading Error</h3>
        <p>Failed to load React. Please refresh the page.</p>
        <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem;">Reload</button>
      </div>
    `;
  }

  function startApp() {
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    // Ensure fallback data exists immediately
    if (!window.cryptoHustleTree) {
      window.cryptoHustleTree = { fields: [] };
    }

    // Utility functions
    const flatten = (nodes, path = []) => nodes.reduce((acc, n) => {
      const currentPath = [...path, {id: n.id, name: n.name}];
      const children = [
        ...(n.categories || []),
        ...(n.subcategories || []),
        ...(n.nodes || []),
        ...(n.subnodes || []),
        ...(n.leafnodes || [])
      ];
      return [...acc, { ...n, path: currentPath, children }, ...flatten(children, currentPath)];
    }, []);

    function flattenTree(fields) {
      return flatten(fields);
    }

    function pathToString(path) {
      if (!Array.isArray(path)) return '';
      return path.map(p => p.name || p).join(' / ');
    }

    // Bookmarks hook
    function useBookmarks() {
      const [bookmarks, setBookmarks] = useState(() => {
        try {
          const raw = window.localStorage.getItem('cryptoExplorer.bookmarks');
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      });

      useEffect(() => {
        try {
          window.localStorage.setItem('cryptoExplorer.bookmarks', JSON.stringify(bookmarks));
        } catch {}
      }, [bookmarks]);

      function toggleBookmark(node) {
        setBookmarks(prev => {
          const exists = prev.some(b => b.id === node.id);
          return exists ? prev.filter(b => b.id !== node.id) : [...prev, node];
        });
      }

      function isBookmarked(nodeId) {
        return bookmarks.some(b => b.id === nodeId);
      }

      return { bookmarks, toggleBookmark, isBookmarked };
    }

    // Simple components
    function UserCard({ userAccount, onToggleAccount, isAccountOpen }) {
      const user = userAccount.getUserData();
      const pfpEmojis = {
        null: '👤',
        crypto1: '🚀',
        crypto2: '⛓️',
        crypto3: '💎',
        crypto4: '🎨'
      };
      const emoji = pfpEmojis[user.pfp] || '👤';

      return React.createElement('div', {
        className: `user-card ${isAccountOpen ? 'user-card--active' : ''}`,
        onClick: onToggleAccount
      }, [
        React.createElement('div', {
          key: 'avatar',
          className: 'user-avatar',
          style: { fontSize: user.pfp ? '1.5rem' : '1rem' }
        }, emoji),
        React.createElement('div', { key: 'meta', className: 'user-meta' }, [
          React.createElement('div', { key: 'name', className: 'user-name' }, user.username),
          React.createElement('div', { key: 'settings', className: 'user-settings-link' }, 'Account settings & configs')
        ])
      ]);
    }

    function MenuWheel({ onToggle }) {
      return React.createElement('button', {
        className: 'menu-wheel-button',
        onClick: onToggle
      }, React.createElement('div', { className: 'menu-wheel-icon' },
        React.createElement('div', { className: 'menu-wheel-dot' })
      ));
    }

    function NavExitButtons({ onGoHome, onGoToTree, currentScreen }) {
      return React.createElement('div', { className: 'nav-exit-buttons' }, [
        currentScreen !== 'home' && React.createElement('button', {
          key: 'home',
          className: 'nav-exit-btn',
          onClick: onGoHome
        }, '← Home'),
        currentScreen !== 'tree' && currentScreen !== 'home' && React.createElement('button', {
          key: 'tree',
          className: 'nav-exit-btn',
          onClick: onGoToTree
        }, '🌳 Tree')
      ].filter(Boolean));
    }

    function NavOverlay({ onClose, onNavigate, isAdmin }) {
      const items = [
        { id: 'tree', label: 'Tree CryptoMap', pill: 'Map' },
        { id: 'my-hustle', label: 'My Hustle', pill: 'Tasks' },
        { id: 'level-up', label: 'Level Up', pill: 'Learn' },
        { id: 'new', label: 'New', pill: 'Articles' },
        { id: 'favorite', label: 'Favorite', pill: 'Bookmarks' },
        { id: 'explore', label: 'Explore', pill: 'Tags' },
        { id: 'contribute', label: 'Contribute', pill: 'Help' }
      ];

      const adminItems = isAdmin ? [
        { id: 'admin-article', label: 'New Article', pill: 'Admin' },
        { id: 'admin-users', label: 'View Users', pill: 'Admin' }
      ] : [];

      return React.createElement('div', {
        className: 'nav-overlay',
        onClick: onClose
      }, React.createElement('div', {
        className: 'nav-panel',
        onClick: e => e.stopPropagation()
      }, [
        React.createElement('div', { key: 'title', className: 'nav-title' }, 'Navigate'),
        React.createElement('div', { key: 'items', className: 'nav-items' }, [
          ...items.map(item => React.createElement('div', {
            key: item.id,
            className: 'nav-item',
            onClick: () => { onNavigate(item.id); onClose(); }
          }, [
            React.createElement('span', { key: 'label', className: 'nav-item-label' }, item.label),
            React.createElement('span', { key: 'pill', className: 'nav-item-pill' }, item.pill)
          ])),
          adminItems.length > 0 && React.createElement('div', { key: 'divider', className: 'nav-divider' }),
          ...adminItems.map(item => React.createElement('div', {
            key: item.id,
            className: 'nav-item nav-item--admin',
            onClick: () => { onNavigate(item.id); onClose(); }
          }, [
            React.createElement('span', { key: 'label', className: 'nav-item-label' }, item.label),
            React.createElement('span', { key: 'pill', className: 'nav-item-pill' }, item.pill)
          ]))
        ].filter(Boolean))
      ]));
    }

    // Home Screen
    function HomeScreen({ userAccount, bookmarksApi, onOpenAccount, onNavigateToTree, onOpenArticle }) {
      const activities = userAccount.getActivitiesSummary();
      const bookmarks = bookmarksApi.bookmarks.slice(0, 3);
      const [isAdmin, setIsAdmin] = useState(userAccount.isAdmin());

      useEffect(() => {
        userAccount.updateStreak();
      }, []);

      const todaysFocus = activities.todaysFocus || (bookmarks.length > 0 ? {
        id: bookmarks[0].id,
        name: bookmarks[0].name,
        path: bookmarks[0].path
      } : null);

      useEffect(() => {
        if (!activities.todaysFocus && bookmarks.length > 0) {
          userAccount.setTodaysFocus(bookmarks[0]);
        }
      }, []);

      const toggleAdmin = () => {
        const newAdminState = !isAdmin;
        if (typeof userAccount.updateUserRole === 'function') {
          userAccount.updateUserRole(newAdminState ? 'admin' : 'user');
        }
        setIsAdmin(newAdminState);
      };

      return React.createElement('div', { className: 'screen' }, [
        // Admin Toggle
        React.createElement('div', {
          key: 'admin-toggle',
          style: {
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: `1px solid ${isAdmin ? '#10b981' : 'rgba(148, 163, 184, 0.3)'}`,
            borderRadius: '8px',
            padding: '0.5rem',
            zIndex: 100,
            fontSize: '0.8rem'
          }
        }, [
          React.createElement('div', {
            key: 'label',
            style: { color: '#94a3b8', marginBottom: '0.25rem' }
          }, 'Admin Mode'),
          React.createElement('button', {
            key: 'button',
            onClick: toggleAdmin,
            style: {
              padding: '0.25rem 0.75rem',
              background: isAdmin ? '#10b981' : '#374151',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '600'
            }
          }, isAdmin ? 'ON' : 'OFF')
        ]),

        React.createElement(UserCard, {
          key: 'user-card',
          userAccount,
          onToggleAccount: onOpenAccount,
          isAccountOpen: false
        }),

        // Home highlights
        React.createElement('div', { key: 'highlights', className: 'home-highlights' }, [
          React.createElement('div', {
            key: 'focus',
            className: 'card',
            onClick: () => todaysFocus && onOpenArticle(todaysFocus),
            style: { cursor: todaysFocus ? 'pointer' : 'default' }
          }, [
            React.createElement('div', { key: 'title', className: 'card-title' }, "Today's Focus"),
            React.createElement('div', { key: 'main', className: 'card-main' }, todaysFocus ? todaysFocus.name : 'No focus set'),
            React.createElement('p', {
              key: 'desc',
              style: { marginTop: '0.35rem', fontSize: '0.85rem', color: '#9ca3af' }
            }, todaysFocus ? 'Continue exploring this topic' : 'Set a focus from your bookmarks')
          ]),

          React.createElement('div', { key: 'streak', className: 'card' }, [
            React.createElement('div', { key: 'title', className: 'card-title' }, 'Streak'),
            React.createElement('div', { key: 'main', className: 'card-main' }, `${activities.streakDays} ${activities.streakDays === 1 ? 'day' : 'days'}`),
            React.createElement('p', {
              key: 'desc',
              style: { marginTop: '0.35rem', fontSize: '0.85rem', color: '#9ca3af' }
            }, 'Keep exploring one new concept per day')
          ]),

          React.createElement('div', {
            key: 'bookmarks',
            className: 'card',
            onClick: () => bookmarks.length > 0 && onNavigateToTree(),
            style: { cursor: bookmarks.length > 0 ? 'pointer' : 'default' }
          }, [
            React.createElement('div', { key: 'title', className: 'card-title' }, 'Bookmarks'),
            React.createElement('div', { key: 'main', className: 'card-main' }, `${bookmarksApi.bookmarks.length} saved`),
            React.createElement('p', {
              key: 'desc',
              style: { marginTop: '0.35rem', fontSize: '0.85rem', color: '#9ca3af' }
            }, bookmarks.length > 0 ? 'Quick access to your favorites' : 'Bookmark articles to access them quickly')
          ])
        ]),

        // Recent bookmarks
        bookmarks.length > 0 && React.createElement('div', {
          key: 'recent',
          style: { marginTop: '2rem' }
        }, [
          React.createElement('h3', {
            key: 'title',
            style: { marginBottom: '0.75rem', fontSize: '1rem' }
          }, 'Recent Bookmarks'),
          React.createElement('div', { key: 'list', className: 'bookmarks-list' },
            bookmarks.map(b => React.createElement('div', {
              key: b.id,
              className: 'bookmarks-list-item',
              onClick: () => onOpenArticle(b)
            }, React.createElement('div', null, [
              React.createElement('div', { key: 'name', className: 'search-result-name' }, b.name),
              React.createElement('div', { key: 'path', className: 'search-result-path' }, b.path ? pathToString(b.path) : '')
            ])))
          )
        ])
      ].filter(Boolean));
    }

    // Fast MyHustle component loader
    function getMyHustleScreen() {
      if (window.MyHustleCore && typeof window.MyHustleCore.render === 'function') {
        return window.MyHustleCore.render;
      }
      return FastMyHustleFallback;
    }

    function FastMyHustleFallback({ onGoHome, onGoToTree }) {
      return React.createElement('div', { className: 'screen', style: { padding: '2rem', textAlign: 'center' } }, [
        React.createElement('h2', { key: 'title' }, 'My Hustle'),
        React.createElement('div', { key: 'icon', style: { fontSize: '3rem', marginBottom: '1rem' } }, '📊'),
        React.createElement('p', { key: 'desc', style: { color: '#94a3b8', marginBottom: '2rem' } }, 'Loading alpha opportunities...'),
        React.createElement('div', { key: 'buttons', style: { display: 'flex', gap: '1rem', justifyContent: 'center' } }, [
          React.createElement('button', { key: 'home', className: 'secondary-button', onClick: onGoHome }, '← Home'),
          React.createElement('button', { key: 'tree', className: 'secondary-button', onClick: onGoToTree }, '🌳 Tree')
        ])
      ]);
    }

    // Fast LevelUp fallback
    function FastLevelUpScreen({ onGoHome, onGoToTree }) {
      return React.createElement('div', { className: 'screen', style: { padding: '2rem', textAlign: 'center' } }, [
        React.createElement('h2', { key: 'title' }, 'Level Up'),
        React.createElement('div', { key: 'icon', style: { fontSize: '3rem', marginBottom: '1rem' } }, '📚'),
        React.createElement('p', { key: 'desc', style: { color: '#94a3b8', marginBottom: '2rem' } }, 'Learning modules loading...'),
        React.createElement('div', { key: 'buttons', style: { display: 'flex', gap: '1rem', justifyContent: 'center' } }, [
          React.createElement('button', { key: 'home', className: 'secondary-button', onClick: onGoHome }, '← Home'),
          React.createElement('button', { key: 'tree', className: 'secondary-button', onClick: onGoToTree }, '🌳 Tree')
        ])
      ]);
    }

    // Fast user account fallback
    const userAccount = (() => {
      if (typeof UserAccount !== 'undefined' && UserAccount) {
        return UserAccount;
      }
      return {
        getUserData: () => ({ 
          username: 'Guest', 
          pfp: null, 
          preferences: { highlightKeywords: [], defaultScreen: 'home' },
          role: 'user'
        }),
        getActivitiesSummary: () => ({ 
          streakDays: 0, 
          todaysFocus: null,
          totalArticlesRead: 0,
          lastArticleRead: null
        }),
        updateStreak: () => {},
        setTodaysFocus: () => {},
        recordArticleRead: () => {},
        isAdmin: () => false,
        updateUserRole: () => {},
        saveTreeState: () => {},
        loadTreeState: () => ({ expandedIds: [], nodePositions: {} })
      };
    })();

    // Admin: New Article Screen
    function AdminNewArticleScreen({ tree, onGoHome, onSave }) {
      const [title, setTitle] = useState('');
      const [description, setDescription] = useState('');
      const [body, setBody] = useState('');
      const [tags, setTags] = useState('');
      const [targetSectionId, setTargetSectionId] = useState('');
      const [locationType, setLocationType] = useState('existing'); // 'existing' or 'custom'
      const [customLocation, setCustomLocation] = useState('');
      const flatNodes = flattenTree(tree.fields || []);

      function handleSave() {
        console.log('handleSave called with:', { title, description, body, targetSectionId, locationType, customLocation, tree });
        
        // Validation based on location type
        if (!title.trim() || !description.trim() || !body.trim()) {
          alert('Please fill in all required fields.');
          return;
        }
        
        if (locationType === 'existing' && !targetSectionId) {
          alert('Please select a target section.');
          return;
        }
        
        if (locationType === 'custom' && !customLocation.trim()) {
          alert('Please enter a custom location name.');
          return;
        }

        const articleData = {
          title: title.trim(),
          description: description.trim(),
          body: body.trim(),
          tags: tags.split(',').map(t => t.trim()).filter(t => t),
          locationType,
          targetSectionId: locationType === 'existing' ? targetSectionId : null,
          customLocation: locationType === 'custom' ? customLocation.trim() : null
        };

        console.log('Article data prepared:', articleData);

        if (typeof window.AdminUtils !== 'undefined') {
          console.log('AdminUtils available, calling saveArticleToTree');
          
          // Handle promise returned by saveArticleToTree
          const savePromise = window.AdminUtils.saveArticleToTree(articleData, targetSectionId, tree);
          
          if (savePromise && typeof savePromise.then === 'function') {
            // It's a promise
            savePromise
              .then(result => {
                console.log('Save result:', result);
                if (result.success) {
                  alert('Article saved successfully!');
                  onSave && onSave();
                } else {
                  alert('Error saving article: ' + (result.error || 'Unknown error'));
                }
              })
              .catch(error => {
                console.error('Save error:', error);
                alert('Error saving article: ' + error.message);
              });
          } else {
            // Fallback for non-promise return
            console.log('Save completed (non-promise)');
            alert('Article saved successfully!');
            onSave && onSave();
          }
        } else {
          console.error('AdminUtils not available');
          alert('Admin utilities not loaded. Please refresh the page.');
        }
      }

      return React.createElement('div', { className: 'screen' }, [
        React.createElement('div', { key: 'nav', className: 'nav-exit-buttons' }, [
          React.createElement('button', { key: 'home', className: 'secondary-button', onClick: onGoHome }, '← Home')
        ]),
        React.createElement('h2', { key: 'title', style: { marginTop: '1.5rem', marginBottom: '0.5rem' } }, 'New Article (Admin)'),
        React.createElement('div', { key: 'desc', className: 'secondary-text', style: { marginBottom: '1.5rem' } }, 'Create and publish a new article section'),
        React.createElement('div', { key: 'form', className: 'admin-article-form' }, [
          React.createElement('div', { key: 'field-group', className: 'form-field' }, [
            React.createElement('label', { key: 'label' }, 'Title *'),
            React.createElement('input', { key: 'input', type: 'text', value: title, onChange: e => setTitle(e.target.value), placeholder: 'Enter article title...', className: 'form-input' })
          ]),
          React.createElement('div', { key: 'field-group-2', className: 'form-field' }, [
            React.createElement('label', { key: 'label' }, 'Description *'),
            React.createElement('textarea', { key: 'textarea', value: description, onChange: e => setDescription(e.target.value), placeholder: 'Brief description...', className: 'form-textarea', rows: 3 })
          ]),
          React.createElement('div', { key: 'field-group-3', className: 'form-field' }, [
            React.createElement('label', { key: 'label' }, 'Body Content *'),
            React.createElement('textarea', { key: 'textarea', value: body, onChange: e => setBody(e.target.value), placeholder: 'Full article content...', className: 'form-textarea', rows: 8 })
          ]),
          React.createElement('div', { key: 'field-group-4', className: 'form-field' }, [
            React.createElement('label', { key: 'label' }, 'Tags (comma-separated)'),
            React.createElement('input', { key: 'input', type: 'text', value: tags, onChange: e => setTags(e.target.value), placeholder: 'crypto, defi, trading...', className: 'form-input' })
          ]),
          React.createElement('div', { key: 'location-group', className: 'form-field' }, [
            React.createElement('label', { key: 'label' }, 'Location Type *'),
            React.createElement('div', { key: 'radio-group', className: 'radio-group' }, [
              React.createElement('label', { key: 'existing-label', className: 'radio-label' }, [
                React.createElement('input', { key: 'existing-radio', type: 'radio', name: 'locationType', value: 'existing', checked: locationType === 'existing', onChange: e => setLocationType(e.target.value) }),
                'Add to existing section'
              ]),
              React.createElement('label', { key: 'custom-label', className: 'radio-label' }, [
                React.createElement('input', { key: 'custom-radio', type: 'radio', name: 'locationType', value: 'custom', checked: locationType === 'custom', onChange: e => setLocationType(e.target.value) }),
                'Create new section'
              ])
            ])
          ]),
          locationType === 'existing' && React.createElement('div', { key: 'existing-section', className: 'form-field' }, [
            React.createElement('label', { key: 'label' }, 'Target Section *'),
            React.createElement('select', { key: 'select', value: targetSectionId, onChange: e => setTargetSectionId(e.target.value), className: 'form-select' }, [
              React.createElement('option', { key: 'default', value: '', disabled: true }, 'Select a section...'),
              ...flatNodes.map(node => React.createElement('option', { key: node.id, value: node.id }, node.name))
            ])
          ]),
          locationType === 'custom' && React.createElement('div', { key: 'custom-section', className: 'form-field' }, [
            React.createElement('label', { key: 'label' }, 'New Section Name *'),
            React.createElement('input', { key: 'input', type: 'text', value: customLocation, onChange: e => setCustomLocation(e.target.value), placeholder: 'Enter new section name...', className: 'form-input' })
          ]),
          React.createElement('div', { key: 'buttons', className: 'form-buttons' }, [
            React.createElement('button', { key: 'save', className: 'primary-button', onClick: handleSave }, 'Save Article'),
            React.createElement('button', { key: 'cancel', className: 'secondary-button', onClick: onGoHome }, 'Cancel')
          ])
        ])
      ]);
    }

    // Main App Root - Ultra fast
    function AppRoot() {
      const [tree, setTree] = useState(() => {
        if (window.cryptoHustleTree && window.cryptoHustleTree.fields) {
          return window.cryptoHustleTree;
        }
        return { fields: [] };
      });
      const [screen, setScreen] = useState('home');
      const [showNav, setShowNav] = useState(false);
      const [articleNode, setArticleNode] = useState(null);
      const [showAccount, setShowAccount] = useState(false);

      const bookmarksApi = useBookmarks();
      const userAccount = useUserAccount();

      // Listen for tree updates and refresh tree state
      useEffect(() => {
        const handleTreeUpdate = (event) => {
          console.log('MainFast: Tree update detected, refreshing tree state');
          if (window.cryptoHustleTree) {
            setTree(window.cryptoHustleTree);
          }
        };
        
        const handleApiTreeUpdate = (event) => {
          console.log('MainFast: API tree update detected, refreshing tree state');
          if (window.cryptoHustleTree) {
            setTree(window.cryptoHustleTree);
          }
        };

        window.addEventListener('treeUpdated', handleTreeUpdate);
        window.addEventListener('apiTreeUpdate', handleApiTreeUpdate);
        
        return () => {
          window.removeEventListener('treeUpdated', handleTreeUpdate);
          window.removeEventListener('apiTreeUpdate', handleApiTreeUpdate);
        };
      }, []);

      // Fast tree loading - no delays
      useEffect(() => {
        if (window.cryptoHustleTree && window.cryptoHustleTree.fields) {
          setTree(window.cryptoHustleTree);
        } else {
          // Single fast API call
          fetch('/api/tree')
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => setTree(data))
            .catch(() => setTree({ fields: [] }));
        }
        
        userAccount.updateStreak();
        const user = userAccount.getUserData();
        if (user.preferences.defaultScreen) {
          setScreen(user.preferences.defaultScreen);
        }
      }, []);

      function openArticle(node) {
        setArticleNode(node);
        setScreen('article');
        userAccount.recordArticleRead(node);
      }

      const isAdmin = typeof UserAccount !== 'undefined' ? UserAccount.isAdmin() : false;

      function handleNavSelect(id) {
        if (id === 'tree') setScreen('tree');
        else if (id === 'my-hustle') setScreen('my-hustle');
        else if (id === 'level-up') setScreen('level-up');
        else if (id === 'favorite') setScreen('favorites');
        else if (id === 'explore') setScreen('explore');
        else if (id === 'new') setScreen('new');
        else if (id === 'contribute') setScreen('contribute');
        else if (id === 'admin-article') setScreen('admin-article');
        else if (id === 'admin-users') setScreen('admin-users');
      }

      function goHome() {
        setScreen('home');
        setShowAccount(false);
      }

      function goToTree() {
        setScreen('tree');
      }

      function handleAccountToggle() {
        setShowAccount(prev => {
          if (prev) {
            setScreen('home');
            return false;
          }
          return true;
        });
      }

      // No loading screen - start immediately
      return React.createElement('div', { className: 'app-root' }, [
        screen === 'home' && !showAccount && React.createElement(HomeScreen, {
          key: 'home',
          userAccount,
          bookmarksApi,
          onOpenAccount: handleAccountToggle,
          onNavigateToTree: () => setScreen('tree'),
          onOpenArticle: openArticle
        }),
        
        screen === 'tree' && !showAccount && window.TreeScreen && React.createElement(window.TreeScreen, {
          key: 'tree',
          tree,
          onOpenArticle: openArticle,
          bookmarksApi
        }),
        
        screen === 'my-hustle' && !showAccount && React.createElement(getMyHustleScreen(), {
          key: 'hustle',
          onGoHome: goHome,
          onGoToTree: goToTree
        }),
        
        screen === 'admin-article' && !showAccount && React.createElement(AdminNewArticleScreen, {
          key: 'admin-article',
          tree,
          onGoHome: goHome,
          onSave: () => {
            console.log('Article saved, navigating to tree');
            setScreen('tree');
          }
        }),
        
        screen === 'level-up' && !showAccount && React.createElement(FastLevelUpScreen, {
          key: 'levelup',
          onGoHome: goHome,
          onGoToTree: goToTree
        }),

        !showAccount && React.createElement(MenuWheel, {
          key: 'menu',
          onToggle: () => setShowNav(true)
        }),
        
        showNav && React.createElement(NavOverlay, {
          key: 'nav',
          onClose: () => setShowNav(false),
          onNavigate: handleNavSelect,
          isAdmin
        })
      ].filter(Boolean));
    }

    // Start immediately
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AppRoot));
  }
})();