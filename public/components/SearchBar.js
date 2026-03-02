// SearchBar.js - Standalone Enhanced Search Component with Smart Suggestions
// This component provides advanced search capabilities including:
// - Article path search (copied paths like "DeFi / Lending / Aave")
// - Link search (paste article URLs to find them)
// - Smart suggestions based on user history, preferences, and view patterns
// - Persistent storage of search history and user preferences

(function(global) {
  'use strict';

  // Check dependencies
  if (typeof React === 'undefined') {
    console.error('SearchBar: React is required');
    return;
  }

  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // ==========================================
  // STORAGE & USER DATA MANAGEMENT
  // ==========================================
  const Storage = {
    KEYS: {
      SEARCH_HISTORY: 'cryptoExplorer.searchHistory',
      USER_PREFERENCES: 'cryptoExplorer.searchPreferences',
      VIEW_HISTORY: 'cryptoExplorer.viewHistory',
      FAVORITE_SEARCHES: 'cryptoExplorer.favoriteSearches'
    },

    getSearchHistory() {
      try {
        return JSON.parse(localStorage.getItem(this.KEYS.SEARCH_HISTORY) || '[]');
      } catch {
        return [];
      }
    },

    addToSearchHistory(query) {
      if (!query || query.trim().length < 2) return;
      
      try {
        const history = this.getSearchHistory();
        const trimmed = query.trim();
        const filtered = history.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
        const updated = [trimmed, ...filtered].slice(0, 30); // Keep last 30 searches
        localStorage.setItem(this.KEYS.SEARCH_HISTORY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save search history:', e);
      }
    },

    getUserPreferences() {
      try {
        const defaults = {
          searchMode: 'smart',
          showSuggestions: true,
          maxSuggestions: 10,
          highlightMatches: true,
          searchInDescription: true,
          searchInTags: true,
          prioritizeRecent: true,
          theme: 'dark'
        };
        return { ...defaults, ...JSON.parse(localStorage.getItem(this.KEYS.USER_PREFERENCES) || '{}') };
      } catch {
        return defaults;
      }
    },

    updateUserPreferences(prefs) {
      try {
        const current = this.getUserPreferences();
        const updated = { ...current, ...prefs };
        localStorage.setItem(this.KEYS.USER_PREFERENCES, JSON.stringify(updated));
        return updated;
      } catch (e) {
        console.warn('Failed to save preferences:', e);
        return prefs;
      }
    },

    getViewHistory() {
      try {
        return JSON.parse(localStorage.getItem(this.KEYS.VIEW_HISTORY) || '[]');
      } catch {
        return [];
      }
    },

    addToViewHistory(nodeId, nodeName, nodePath = []) {
      if (!nodeId) return;
      
      try {
        const history = this.getViewHistory();
        const filtered = history.filter(item => item.nodeId !== nodeId);
        const updated = [{
          nodeId,
          nodeName,
          nodePath: Array.isArray(nodePath) ? nodePath : [nodePath].filter(Boolean),
          timestamp: Date.now(),
          visitCount: (history.find(h => h.nodeId === nodeId)?.visitCount || 0) + 1
        }, ...filtered].slice(0, 100);
        localStorage.setItem(this.KEYS.VIEW_HISTORY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save view history:', e);
      }
    },

    getFavoriteSearches() {
      try {
        return JSON.parse(localStorage.getItem(this.KEYS.FAVORITE_SEARCHES) || '[]');
      } catch {
        return [];
      }
    },

    toggleFavoriteSearch(query) {
      try {
        const favorites = this.getFavoriteSearches();
        const exists = favorites.includes(query);
        const updated = exists 
          ? favorites.filter(f => f !== query)
          : [query, ...favorites].slice(0, 20);
        localStorage.setItem(this.KEYS.FAVORITE_SEARCHES, JSON.stringify(updated));
        return !exists;
      } catch (e) {
        console.warn('Failed to toggle favorite:', e);
        return false;
      }
    },

    clearSearchHistory() {
      localStorage.removeItem(this.KEYS.SEARCH_HISTORY);
    },

    clearViewHistory() {
      localStorage.removeItem(this.KEYS.VIEW_HISTORY);
    }
  };

  // ==========================================
  // SEARCH MODE DETECTION & PARSING
  // ==========================================
  const SearchUtils = {
    detectSearchMode(query) {
      const trimmed = query.trim();
      
      if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed) || /:\/\//.test(trimmed)) {
        return 'link';
      }
      
      if (/[\/\\]/.test(trimmed) && trimmed.includes(' / ')) {
        return 'path';
      }
      
      if (/^[^\/]+\/[\/\\]/.test(trimmed) || trimmed.startsWith('/')) {
        return 'path';
      }
      
      if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed)) {
        return 'id';
      }
      
      if (/^[a-z0-9]{6,}$/i.test(trimmed)) {
        return 'id';
      }
      
      return 'text';
    },

    parseArticleLink(link) {
      const trimmed = link.trim();
      
      try {
        let urlStr = trimmed;
        if (trimmed.startsWith('www.')) {
          urlStr = 'https://' + trimmed;
        }
        
        if (/^https?:\/\//i.test(urlStr)) {
          const url = new URL(urlStr);
          
          const fromParams = url.searchParams.get('id') || 
                            url.searchParams.get('article') || 
                            url.searchParams.get('node');
          if (fromParams) return fromParams;
          
          const pathParts = url.pathname.split('/').filter(p => p);
          const lastPart = pathParts[pathParts.length - 1];
          if (lastPart && /^[a-z0-9-]+$/i.test(lastPart)) {
            return lastPart;
          }
          
          if (url.hash) {
            return url.hash.substring(1);
          }
        }
        
        return null;
      } catch {
        const match = trimmed.match(/[?&](id|article|node)=([^&]+)/);
        if (match) return decodeURIComponent(match[2]);
        
        const hashMatch = trimmed.match(/#(.+)$/);
        if (hashMatch) return hashMatch[1];
        
        return null;
      }
    },

    normalizePath(path) {
      return path
        .replace(/\\/g, ' / ')
        .replace(/\//g, ' / ')
        .replace(/\s+/g, ' ')
        .replace(/\s*\/\s*/g, ' / ')
        .trim();
    },

    parsePath(path) {
      const normalized = this.normalizePath(path);
      // Ensure path is a string before splitting
      const pathStr = typeof normalized === 'string' ? normalized : String(normalized || '');
      return pathStr.split(' / ').map(p => p.trim()).filter(Boolean);
    },

    calculateRelevance(node, query, queryLower, mode) {
      let score = 0;
      const nameLower = node.name?.toLowerCase() || '';
      const descLower = node.description?.toLowerCase() || '';
      
      // Handle pathString safely - it could be string, array, or undefined
      let pathString = node.fullPath || node.pathString || nameLower;
      if (Array.isArray(pathString)) {
        pathString = pathString.join(' / ');
      } else if (typeof pathString !== 'string') {
        pathString = String(pathString || '');
      }
      
      const pathArray = pathString.split(' / ');
      
      if (nameLower === queryLower) score += 100;
      else if (nameLower.startsWith(queryLower)) score += 80;
      else if (nameLower.includes(queryLower)) score += 60;
      
      if (pathString.includes(queryLower)) score += 40;
      if (pathArray.some(p => p.toLowerCase().startsWith(queryLower))) score += 30;
      
      if (descLower.includes(queryLower)) score += 20;
      
      if (node.tags?.some(t => t.toLowerCase().includes(queryLower))) score += 25;
      
      const viewHistory = Storage.getViewHistory();
      const viewRecord = viewHistory.find(v => v.nodeId === node.id);
      if (viewRecord) {
        score += Math.min(viewRecord.visitCount * 5, 30);
        if (viewRecord.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) {
          score += 20;
        }
      }
      
      return score;
    }
  };

  // ==========================================
  // SMART SUGGESTIONS ENGINE
  // ==========================================
  const SuggestionsEngine = {
    formatTimeAgo(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    },

    generate(query, flatNodes, preferences) {
      const suggestions = [];
      const queryLower = query.toLowerCase().trim();
      const searchMode = SearchUtils.detectSearchMode(query);
      const hasStrongNameMatch = queryLower.length >= 2 && flatNodes.some(n => (n.name || '').toLowerCase().startsWith(queryLower));
      
      if (!queryLower || queryLower.length < 1) {
        return this.getDefaultSuggestions(flatNodes);
      }

      if (searchMode === 'link') {
        const articleId = SearchUtils.parseArticleLink(query);
        if (articleId) {
          const node = flatNodes.find(n => 
            n.id === articleId || 
            n.id?.toLowerCase() === articleId.toLowerCase()
          );
          if (node) {
            suggestions.push({
              type: 'link-match',
              priority: 100,
              text: node.name,
              display: node.name,
              icon: '🔗',
              description: 'Found article from link',
              node: node,
              action: 'navigate'
            });
          }
        }
      }

      if (searchMode === 'path') {
        const pathParts = SearchUtils.parsePath(query);
        const pathMatches = flatNodes.filter(node => {
          const nodePath = node.fullPath || node.pathString || '';
          if (!nodePath) return false;
          const nodePathStr = (Array.isArray(nodePath)
            ? nodePath.join(' / ')
            : (typeof nodePath === 'string' ? nodePath : String(nodePath || ''))
          ).toLowerCase();
          return pathParts.every(part => nodePathStr.includes(part.toLowerCase()));
        }).slice(0, 5);

        pathMatches.forEach((node, idx) => {
          const nodePath = node.fullPath || node.pathString || '';
          // Handle nodePath safely - ensure it's a string before splitting
          const pathStr = Array.isArray(nodePath) ? nodePath.join(' / ') : (typeof nodePath === 'string' ? nodePath : String(nodePath || ''));
          suggestions.push({
            type: 'path-match',
            priority: 90 - idx * 5,
            text: nodePath,
            display: node.name,
            icon: '📂',
            description: `Path: ${pathStr.split(' / ').slice(0, -1).join(' / ') || 'Root'}`,
            node: node,
            action: 'navigate'
          });
        });
      }

      // For plain text queries, prioritize direct name/path navigation results
      if (searchMode === 'text' && queryLower.length >= 2) {
        const nameMatches = flatNodes
          .filter(node => {
            const nameLower = (node.name || '').toLowerCase();
            return nameLower && (nameLower === queryLower || nameLower.startsWith(queryLower));
          })
          .slice(0, 6);

        nameMatches.forEach((node, idx) => {
          if (suggestions.some(s => s.node?.id && s.node.id === node.id)) return;
          const nodePath = node.fullPath || node.pathString || '';
          const pathStr = Array.isArray(nodePath) ? nodePath.join(' / ') : (typeof nodePath === 'string' ? nodePath : String(nodePath || ''));
          suggestions.push({
            type: 'name-match',
            priority: 95 - idx * 3,
            text: node.name,
            display: node.name,
            icon: '📂',
            description: `Path: ${pathStr || node.name}`,
            node: node,
            action: 'navigate'
          });
        });
      }

      const searchHistory = Storage.getSearchHistory();
      const historyMatches = searchHistory
        .filter(item => item.toLowerCase().includes(queryLower))
        .slice(0, hasStrongNameMatch ? 1 : 3);

      historyMatches.forEach(item => {
        suggestions.push({
          type: 'history',
          priority: 50,
          text: item,
          display: item,
          icon: '🕐',
          description: 'Recent search',
          action: 'search'
        });
      });

      const viewHistory = Storage.getViewHistory();
      const recentViews = viewHistory
        .filter(item => 
          item.nodeName.toLowerCase().includes(queryLower) ||
          item.nodePath?.some(p => p.toLowerCase().includes(queryLower))
        )
        .slice(0, 4);

      recentViews.forEach((item, idx) => {
        const node = flatNodes.find(n => n.id === item.nodeId);
        suggestions.push({
          type: 'recent-view',
          priority: 70 - idx * 5,
          text: item.nodeName,
          display: item.nodeName,
          icon: '👁️',
          description: `Viewed ${this.formatTimeAgo(item.timestamp)}`,
          node: node,
          nodeId: item.nodeId,
          action: 'navigate'
        });
      });

      if (recentViews.length === 0) {
        const frequentViews = viewHistory
          .filter(item => item.visitCount > 2)
          .sort((a, b) => b.visitCount - a.visitCount)
          .slice(0, 2);

        frequentViews.forEach(item => {
          if (!suggestions.some(s => s.nodeId === item.nodeId)) {
            const node = flatNodes.find(n => n.id === item.nodeId);
            suggestions.push({
              type: 'frequent-view',
              priority: 40,
              text: item.nodeName,
              display: item.nodeName,
              icon: '🔥',
              description: `Viewed ${item.visitCount} times`,
              node: node,
              nodeId: item.nodeId,
              action: 'navigate'
            });
          }
        });
      }

      const textMatches = flatNodes
        .filter(node => {
          const nameLower = node.name?.toLowerCase() || '';
          const descLower = node.description?.toLowerCase() || '';
          return nameLower.includes(queryLower) || 
                 (preferences.searchInDescription && descLower.includes(queryLower));
        })
        .map(node => ({
          node,
          score: SearchUtils.calculateRelevance(node, query, queryLower, searchMode)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      textMatches.forEach((match, idx) => {
        const node = match.node;
        const desc = node.description 
          ? (node.description.length > 60 ? node.description.substring(0, 60) + '...' : node.description)
          : (node.fullPath ? node.fullPath.join(' / ') : 'No description');
        
        suggestions.push({
          type: 'text-match',
          priority: match.score,
          text: node.name,
          display: node.name,
          icon: '📄',
          description: desc,
          node: node,
          action: 'navigate'
        });
      });

      const favorites = Storage.getFavoriteSearches();
      const favoriteMatches = favorites
        .filter(f => f.toLowerCase().includes(queryLower))
        .slice(0, 2);

      favoriteMatches.forEach(fav => {
        if (!suggestions.some(s => s.text.toLowerCase() === fav.toLowerCase())) {
          suggestions.push({
            type: 'favorite',
            priority: 45,
            text: fav,
            display: fav,
            icon: '⭐',
            description: 'Favorite search',
            action: 'search'
          });
        }
      });

      return suggestions
        .sort((a, b) => b.priority - a.priority)
        .slice(0, preferences.maxSuggestions || 10);
    },

    getDefaultSuggestions(flatNodes) {
      const suggestions = [];
      const viewHistory = Storage.getViewHistory();
      const favorites = Storage.getFavoriteSearches();

      const recentSearches = Storage.getSearchHistory().slice(0, 3);
      if (recentSearches.length > 0) {
        suggestions.push({ type: 'header', text: 'Recent Searches', icon: '🕐' });
        recentSearches.forEach(search => {
          suggestions.push({
            type: 'history',
            text: search,
            display: search,
            icon: '🔍',
            description: 'Click to search again',
            action: 'search'
          });
        });
      }

      const recentViews = viewHistory.slice(0, 3);
      if (recentViews.length > 0) {
        suggestions.push({ type: 'header', text: 'Recently Viewed', icon: '👁️' });
        recentViews.forEach(view => {
          const node = flatNodes.find(n => n.id === view.nodeId);
          suggestions.push({
            type: 'recent-view',
            text: view.nodeName,
            display: view.nodeName,
            icon: '📄',
            description: `Viewed ${this.formatTimeAgo(view.timestamp)}`,
            node: node,
            nodeId: view.nodeId,
            action: 'navigate'
          });
        });
      }

      if (favorites.length > 0) {
        suggestions.push({ type: 'header', text: 'Favorites', icon: '⭐' });
        favorites.slice(0, 2).forEach(fav => {
          suggestions.push({
            type: 'favorite',
            text: fav,
            display: fav,
            icon: '⭐',
            description: 'Favorite search',
            action: 'search'
          });
        });
      }

      return suggestions;
    }
  };

  // ==========================================
  // SEARCH EXECUTION
  // ==========================================
  const SearchEngine = {
    execute(query, flatNodes, preferences) {
      const searchMode = SearchUtils.detectSearchMode(query);
      const trimmed = query.trim().toLowerCase();
      
      if (!trimmed) return [];
      
      let results = [];
      
      switch (searchMode) {
        case 'link':
          results = this.searchByLink(query, flatNodes);
          break;
          
        case 'path':
          results = this.searchByPath(query, flatNodes);
          break;
          
        case 'id':
          results = this.searchById(trimmed, flatNodes);
          break;
          
        case 'text':
        default:
          results = this.searchByText(trimmed, flatNodes, preferences);
          break;
      }
      
      Storage.addToSearchHistory(query);
      
      return results
        .map(node => ({
          node,
          score: SearchUtils.calculateRelevance(node, query, trimmed, searchMode)
        }))
        .sort((a, b) => b.score - a.score)
        .map(r => r.node);
    },

    searchByLink(link, flatNodes) {
      const articleId = SearchUtils.parseArticleLink(link);
      if (!articleId) return [];
      
      const node = flatNodes.find(n => 
        n.id === articleId || 
        n.id?.toLowerCase() === articleId.toLowerCase()
      );
      
      return node ? [node] : [];
    },

    searchByPath(path, flatNodes) {
      const pathParts = SearchUtils.parsePath(path);
      return flatNodes.filter(node => {
        if (!node.fullPath) return false;
        const nodePathStr = node.fullPath.join(' / ').toLowerCase();
        return pathParts.every(part => nodePathStr.includes(part.toLowerCase()));
      });
    },

    searchById(id, flatNodes) {
      return flatNodes.filter(node => 
        node.id?.toLowerCase() === id ||
        node.id?.toLowerCase().includes(id)
      );
    },

    searchByText(query, flatNodes, preferences) {
      return flatNodes.filter(node => {
        const nameLower = node.name?.toLowerCase() || '';
        const descLower = node.description?.toLowerCase() || '';
        const pathString = node.fullPath ? node.fullPath.join(' / ').toLowerCase() : '';
        
        return nameLower.includes(query) ||
               pathString.includes(query) ||
               (preferences.searchInDescription && descLower.includes(query)) ||
               (preferences.searchInTags && node.tags?.some(t => t.toLowerCase().includes(query)));
      });
    }
  };

  // ==========================================
  // UI COMPONENTS
  // ==========================================
  const Icons = {
    search: '🔍',
    link: '🔗',
    path: '📂',
    id: '🆔',
    text: '📝',
    history: '🕐',
    view: '👁️',
    favorite: '⭐',
    fire: '🔥',
    clear: '✕',
    settings: '⚙️',
    arrow: '→'
  };

  function SearchBarComponent({ 
    onSearch, 
    onResultSelect, 
    flatNodes = [], 
    placeholder = 'Search articles, paste links, or type paths...',
    className = ''
  }) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchMode, setSearchMode] = useState('text');
    const [preferences, setPreferences] = useState({});
    const [isFocused, setIsFocused] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
      setPreferences(Storage.getUserPreferences());
    }, []);

    useEffect(() => {
      const mode = SearchUtils.detectSearchMode(query);
      setSearchMode(mode);

      if (query.length >= 1 && preferences.showSuggestions !== false) {
        const newSuggestions = SuggestionsEngine.generate(query, flatNodes, preferences);
        setSuggestions(newSuggestions);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } else if (query.length === 0 && isFocused) {
        const defaultSuggestions = SuggestionsEngine.getDefaultSuggestions(flatNodes);
        setSuggestions(defaultSuggestions);
        setShowSuggestions(defaultSuggestions.length > 0);
        setSelectedIndex(-1);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, [query, flatNodes, preferences, isFocused]);

    const handleKeyDown = useCallback((e) => {
      if (!showSuggestions || suggestions.length === 0) {
        if (e.key === 'Enter') {
          e.preventDefault();
          performSearch();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            handleSuggestionSelect(suggestions[selectedIndex]);
          } else {
            performSearch();
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          inputRef.current?.blur();
          break;
      }
    }, [showSuggestions, suggestions, selectedIndex]);

    const performSearch = useCallback(() => {
      if (!query.trim()) return;

      console.log('SearchBar: Performing search for:', query);
      const results = SearchEngine.execute(query, flatNodes, preferences);
      console.log('SearchBar: Search results:', results.length, 'items');

      // CRITICAL: UI update happens FIRST, before any external calls
      onSearch?.(query, results, searchMode);
      setShowSuggestions(false);

      // Enhanced Firebase logging with UserActivityTracker
      if (typeof window !== 'undefined' && window.UserActivityTracker) {
        window.UserActivityTracker.trackSearch(query, searchMode, results.length);
      } else if (typeof firebase !== 'undefined') {
        // Fallback to original logging
        setTimeout(() => {
          try {
            const db = firebase.firestore();
            db.collection('global_trends').add({
              query: query.trim(),
              mode: searchMode,
              resultsCount: results.length,
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
              console.log('[Firebase Debug] Search log successful');
            }).catch((error) => {
              console.warn('[Firebase Error] Search log failed (non-blocking):', error.message);
            });
          } catch (setupError) {
            console.warn('[Firebase Error] Search log setup failed (non-blocking):', setupError.message);
          }
        }, 0);
      }

      if (results.length === 1 && (searchMode === 'link' || searchMode === 'id')) {
        console.log('SearchBar: Auto-navigating to single result:', results[0].id);

        // Add visual feedback for auto-navigation
        const targetElement = document.querySelector(`[data-node-id="${results[0].id}"]`);
        if (targetElement) {
          targetElement.style.transition = 'all 0.2s ease';
          targetElement.style.boxShadow = '0 8px 25px rgba(168, 85, 247, 0.6)';
          setTimeout(() => {
            targetElement.style.boxShadow = '';
          }, 300);
        }

        // UI update happens immediately after visual feedback setup
        console.log('UI Update: Unfolding tile for ID:', results[0].id);
        onResultSelect?.(results[0]);
        setQuery('');
      }
    }, [query, flatNodes, preferences, onSearch, onResultSelect, searchMode]);

    const handleSuggestionSelect = useCallback((suggestion) => {
      console.log('[SearchBar Debug] handleSuggestionSelect called:', suggestion.type, suggestion.text);

      if (suggestion.action === 'navigate' && suggestion.node) {
        console.log('[SearchBar Debug] Navigating to node:', suggestion.node.id, suggestion.node.name);

        // CRITICAL: UI STATE UPDATE HAPPENS IMMEDIATELY - BEFORE ANY EXTERNAL CALLS
        console.log('UI Update: Unfolding tile for ID:', suggestion.node.id);
        onResultSelect?.(suggestion.node);

        // Use AutoUnfold mechanics for proper tree unfolding
        setTimeout(() => {
          if (window.AutoUnfold && typeof window.AutoUnfold.unfoldFromSearch === 'function') {
            console.log('[SearchBar Debug] Using AutoUnfold for navigation');
            window.AutoUnfold.unfoldFromSearch(suggestion.node.id, suggestion.node.name);
          } else {
            console.warn('[SearchBar Debug] AutoUnfold not available, falling back to TreeScreenExpandToNode');
            // Fallback to original method
            if (window.TreeScreenExpandToNode && typeof window.TreeScreenExpandToNode === 'function') {
              window.TreeScreenExpandToNode(suggestion.node.id, true);
            }
          }
        }, 100);

        // Add immediate visual feedback
        const targetElement = document.querySelector(`[data-node-id="${suggestion.node.id}"]`);
        if (targetElement) {
          targetElement.style.transition = 'all 0.2s ease';
          targetElement.style.boxShadow = '0 8px 25px rgba(251, 146, 60, 0.6)';
          setTimeout(() => {
            targetElement.style.boxShadow = '';
          }, 300);
        }

        // Clear query after UI update to prevent tile disappearance
        setTimeout(() => {
          console.log('[SearchBar Debug] Clearing query after UI update');
          setQuery('');
        }, 100);

        // Add to view history with error handling (non-blocking)
        setTimeout(() => {
          try {
            const nodePath = suggestion.node.fullPath || suggestion.node.pathString || '';
            // Handle nodePath safely - ensure it's a string before splitting
            const pathStr = Array.isArray(nodePath) ? nodePath.join(' / ') : (typeof nodePath === 'string' ? nodePath : String(nodePath || ''));
            const pathArray = pathStr ? pathStr.split(' / ') : [];
            Storage.addToViewHistory(suggestion.node.id, suggestion.node.name, pathArray);
          } catch (error) {
            console.warn('[SearchBar Error] Failed to add to view history (non-blocking):', error);
          }
        }, 0);

        // Enhanced Firebase logging with UserActivityTracker
        if (typeof window !== 'undefined' && window.UserActivityTracker) {
          window.UserActivityTracker.trackSearch(suggestion.node.name, 'navigation', 1);
          window.UserActivityTracker.trackTileOpen(suggestion.node);
        } else if (typeof firebase !== 'undefined') {
          // Fallback to original logging
          setTimeout(() => {
            try {
              const db = firebase.firestore();
              db.collection('global_trends').add({
                query: suggestion.node.name,
                mode: 'navigation',
                resultsCount: 1,
                nodeId: suggestion.node.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
              }).then(() => {
                console.log('[Firebase Debug] Navigation log successful');
              }).catch((error) => {
                console.warn('[Firebase Error] Navigation log failed (non-blocking):', error.message);
              });
            } catch (setupError) {
              console.warn('[Firebase Error] Navigation log setup failed (non-blocking):', setupError.message);
            }
          }, 0);
        }

      } else if (suggestion.action === 'search') {
        console.log('[SearchBar Debug] Searching for:', suggestion.text);
        setQuery(suggestion.text);
        const results = SearchEngine.execute(suggestion.text, flatNodes, preferences);
        onSearch?.(suggestion.text, results, searchMode);
      }

      // Hide suggestions after selection
      setShowSuggestions(false);
    }, [onResultSelect, onSearch, flatNodes, preferences, searchMode]);

    const handleClear = useCallback(() => {
      setQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
      onSearch?.('', [], 'clear');
      inputRef.current?.focus();
    }, [onSearch]);

    const getModeIcon = () => {
      switch (searchMode) {
        case 'link': return Icons.link;
        case 'path': return Icons.path;
        case 'id': return Icons.id;
        default: return Icons.search;
      }
    };

    const getModeLabel = () => {
      switch (searchMode) {
        case 'link': return 'Link';
        case 'path': return 'Path';
        case 'id': return 'ID';
        case 'text': return 'Text';
        default: return 'Search';
      }
    };

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setShowSuggestions(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const renderSuggestion = (suggestion, index) => {
      const isSelected = index === selectedIndex;
      
      if (suggestion.type === 'header') {
        return React.createElement('div', {
          key: `header-${index}`,
          className: 'suggestion-header'
        }, `${suggestion.icon} ${suggestion.text}`);
      }

      return React.createElement('div', {
        key: `sugg-${index}`,
        className: `suggestion-item type-${suggestion.type} ${isSelected ? 'selected' : ''}`,
        onClick: () => handleSuggestionSelect(suggestion),
        onMouseEnter: () => setSelectedIndex(index)
      }, [
        React.createElement('span', {
          key: 'icon',
          className: 'suggestion-icon'
        }, suggestion.icon),
        
        React.createElement('div', {
          key: 'content',
          className: 'suggestion-content'
        }, [
          React.createElement('div', {
            key: 'display',
            className: 'suggestion-display'
          }, suggestion.display),
          
          React.createElement('div', {
            key: 'description',
            className: 'suggestion-description'
          }, suggestion.description)
        ]),
        
        suggestion.action === 'navigate' && React.createElement('span', {
          key: 'action',
          className: 'suggestion-action'
        }, Icons.arrow)
      ]);
    };

    return React.createElement('div', {
      ref: containerRef,
      className: `enhanced-search-bar ${className} ${showSuggestions && suggestions.length > 0 ? 'has-suggestions' : ''} ${isFocused ? 'focused' : ''}`
    }, [
      React.createElement('div', {
        key: 'input-wrapper',
        className: 'search-input-wrapper'
      }, [
        React.createElement('div', {
          key: 'mode-indicator',
          className: `mode-indicator ${searchMode !== 'text' ? searchMode + '-mode' : ''}`,
          title: `Search mode: ${getModeLabel()}`
        }, getModeIcon()),

        React.createElement('input', {
          key: 'input',
          ref: inputRef,
          type: 'text',
          value: query,
          onChange: (e) => setQuery(e.target.value),
          onFocus: () => setIsFocused(true),
          onBlur: () => setTimeout(() => setIsFocused(false), 150),
          onKeyDown: handleKeyDown,
          placeholder: placeholder
        }),

        query.length > 0 && React.createElement('button', {
          key: 'clear-btn',
          className: 'clear-btn',
          onClick: handleClear,
          title: 'Clear search'
        }, Icons.clear),

        React.createElement('button', {
          key: 'search-btn',
          className: 'search-btn',
          onClick: performSearch,
          title: 'Search'
        }, Icons.search)
      ]),

      showSuggestions && suggestions.length > 0 && React.createElement('div', {
        key: 'suggestions',
        className: 'search-suggestions'
      }, suggestions.map((s, i) => renderSuggestion(s, i)))
    ]);
  }

  // ==========================================
  // PUBLIC API
  // ==========================================
  const SearchBar = {
    Component: SearchBarComponent,
    Storage: Storage,
    Utils: SearchUtils,
    Engine: SearchEngine,
    Suggestions: SuggestionsEngine,
    Icons: Icons,
    addToViewHistory: Storage.addToViewHistory.bind(Storage),
    getViewHistory: Storage.getViewHistory.bind(Storage),
    clearHistory: Storage.clearSearchHistory.bind(Storage),
    clearViewHistory: Storage.clearViewHistory.bind(Storage),
    toggleFavorite: Storage.toggleFavoriteSearch.bind(Storage),
    detectMode: SearchUtils.detectSearchMode.bind(SearchUtils),
    parseLink: SearchUtils.parseArticleLink.bind(SearchUtils)
  };

  global.SearchBar = SearchBar;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchBar;
  }

})(typeof window !== 'undefined' ? window : global);

