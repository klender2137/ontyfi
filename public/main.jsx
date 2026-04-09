// Simple initialization without complex dependency checking
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // Add longer delay to ensure all scripts are loaded
  setTimeout(initializeApp, 1000);
}

function initializeApp() {
  console.log('Initializing app...');
  
  // Ensure React is available
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error('React not loaded, retrying in 500ms');
    setTimeout(initializeApp, 500);
    return;
  }

  // Wait for components to be loaded with retries
  let retryCount = 0;
  const maxRetries = 10;
  
  function checkComponents() {
    const componentsLoaded = {
      LevelUpScreen: typeof window.LevelUpScreen === 'function',
      TreeScreen: typeof window.TreeScreen === 'function',
      UserAccount: typeof window.UserAccount === 'function',
      cryptoHustleTree: typeof window.cryptoHustleTree !== 'undefined'
    };
    
    console.log(`Component availability (attempt ${retryCount + 1}):`, componentsLoaded);
    
    // Check if all critical components are loaded
    const allLoaded = Object.values(componentsLoaded).every(loaded => loaded);
    
    if (allLoaded) {
      console.log('✅ All components loaded successfully!');
      startApp();
    } else if (retryCount < maxRetries) {
      retryCount++;
      console.log(`⏳ Waiting for components... retry ${retryCount}/${maxRetries}`);
      setTimeout(checkComponents, 500);
    } else {
      console.warn('⚠️ Some components failed to load, continuing with available components');
      startApp();
    }
  }
  
  checkComponents();
}

function startApp() {
  console.log('Starting main application...');

  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  async function syncRoleAndProfile(firebaseUser) {
    if (!firebaseUser) return null;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/auth-simple/role-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || 'Role sync failed');
      }

      await firebaseUser.getIdToken(true);

      // Merge server profile with Firebase user profile
      const serverProfile = body?.profile || {};
      const firebaseProfile = {
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        ...serverProfile
      };

      try {
        if (typeof UserAccount !== 'undefined' && UserAccount?.mergeFromFirebaseProfile) {
          UserAccount.mergeFromFirebaseProfile(firebaseProfile);
        }
      } catch (e) {
        console.warn('[Main] Failed to merge Firebase profile:', e);
      }

      return firebaseProfile;
    } catch (e) {
      console.warn('[Main] role/profile sync failed:', e?.message || e);
      return null;
    }
  }

  function waitForGlobal(checkFn, { timeoutMs = 8000, intervalMs = 100 } = {}) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        try {
          const value = checkFn();
          if (value) return resolve(value);
        } catch {}

        if (Date.now() - start >= timeoutMs) {
          return reject(new Error('Timeout waiting for required global'));
        }
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  if (typeof window !== 'undefined' && !window.CryptoExplorerLibsReady) {
    const siweReady = waitForGlobal(() => window.SiweMessage, { timeoutMs: 12000 });
    const solanaReady = waitForGlobal(() => window.solanaWeb3 || window.solana, { timeoutMs: 12000 });

    window.CryptoExplorerLibsReady = {
      siwe: siweReady,
      solana: solanaReady,
      all: Promise.allSettled([siweReady, solanaReady]).then((results) => {
        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length) {
          throw failures[0].reason;
        }
        return true;
      }),
    };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.addEventListener('load', () => {
        s.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      s.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      document.head.appendChild(s);
    });
  }

  function isGuestSessionActive() {
    try {
      return window.localStorage.getItem('cryptoExplorer.guestMode') === 'true';
    } catch {
      return false;
    }
  }

  function setGuestSessionActive(active) {
    try {
      window.localStorage.setItem('cryptoExplorer.guestMode', active ? 'true' : 'false');
    } catch {}
  }

// Utility: Flatten tree structure with complete path hierarchy
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

// Build full hierarchical path from prime tile to current tile
function buildFullTilePath(node, flatNodes) {
  if (!node || !flatNodes) return '';
  
  // Find the node in flatNodes to get its path
  const foundNode = flatNodes.find(n => n.id === node.id);
  if (!foundNode || !foundNode.path) return node.name;
  
  // Extract just the names from the path hierarchy
  const pathNames = foundNode.path.map(pathItem => 
    typeof pathItem === 'string' ? pathItem : (pathItem.name || pathItem)
  );
  
  // Add the current node name at the end
  const fullPath = [...pathNames, node.name];
  
  return fullPath.join(' / ');
}

function getNodeChildren(node) {
  return [
    ...(node.categories || []),
    ...(node.subcategories || []),
    ...(node.nodes || []),
    ...(node.subnodes || []),
    ...(node.leafnodes || [])
  ];
}

// Helper function to get user-specific localStorage key
const getUserBookmarkKey = () => {
  // Try to get current Firebase user ID
  if (typeof firebase !== 'undefined' && firebase.auth) {
    const currentUser = firebase.auth().currentUser;
    if (currentUser && currentUser.uid) {
      return `cryptoExplorer.bookmarks.${currentUser.uid}`;
    }
  }
  // Fallback to guest
  return 'cryptoExplorer.bookmarks.guest';
};

// Bookmarks hook
function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const bookmarkKey = getUserBookmarkKey();
      const raw = window.localStorage.getItem(bookmarkKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const bookmarkKey = getUserBookmarkKey();
      window.localStorage.setItem(bookmarkKey, JSON.stringify(bookmarks));
    } catch {}
  }, [bookmarks]);

  function toggleBookmark(node) {
    setBookmarks(prev => {
      const exists = prev.some(b => b.id === node.id);
      const action = exists ? 'remove' : 'add';
      
      // Track bookmark activity with UserActivityTracker
      if (typeof window !== 'undefined' && window.UserActivityTracker) {
        window.UserActivityTracker.trackBookmark(action, node);
      }
      
      return exists ? prev.filter(b => b.id !== node.id) : [...prev, node];
    });
  }

  function isBookmarked(nodeId) {
    return bookmarks.some(b => b.id === nodeId);
  }

  async function syncBookmarksWithFirebase() {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase not available for bookmarks sync');
      return;
    }

    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      const userId = currentUser?.uid || 'anonymous-user';

      // Fetch from Firestore
      const userDocRef = db.collection('users').doc(userId);
      const docSnap = await userDocRef.get();
      if (docSnap.exists()) {
        const data = docSnap.data();
        const remoteBookmarks = data.favorites || [];
        setBookmarks(remoteBookmarks);
        
        // Update localStorage with synced bookmarks
        const bookmarkKey = getUserBookmarkKey();
        window.localStorage.setItem(bookmarkKey, JSON.stringify(remoteBookmarks));
        console.log('Bookmarks synced from Firebase');
      }

      // Save current bookmarks to Firestore
      await userDocRef.set({ favorites: bookmarks }, { merge: true });
      console.log('Bookmarks synced to Firebase');
    } catch (error) {
      console.error('Error syncing bookmarks with Firebase:', error);
    }
  }

  return { bookmarks, toggleBookmark, isBookmarked, syncBookmarksWithFirebase };
}

// Full Description hook
function useFullDescription(descriptionRef, nodeTitle) {
  const [fullDescription, setFullDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Simple markdown renderer for basic GitHub-style formatting
  function renderMarkdown(text) {
    if (!text) return '';

    // Split into lines and process
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      // Handle headers (but skip ## Description and ## Tags)
      if (line.startsWith('## ')) {
        const headerText = line.substring(3).trim();
        if (headerText.toLowerCase() === 'description' || headerText.toLowerCase() === 'tags') {
          return null; // Skip these headers
        }
        return `<h2 style="margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600; color: #f7f9ff;">${escapeHtml(headerText)}</h2>`;
      }

      // Handle H3 headers (### )
      if (line.startsWith('### ')) {
        const headerText = line.substring(4).trim();
        return `<h3 style="margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.25rem; font-weight: 600; color: #f7f9ff;">${escapeHtml(headerText)}</h3>`;
      }

      // Handle horizontal rules
      if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
        return `<hr style="border: none; height: 1px; background: rgba(148, 163, 184, 0.3); margin: 2rem 0;" />`;
      }

      // Skip table separator lines (|:---|:---|)
      if (line.includes('|') && /:\s*[-]+\s*:/.test(line)) {
        return null;
      }

      // Handle table rows
      if (line.includes('|') && !line.startsWith('#')) {
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        if (cells.length > 1) {
          const isHeaderRow = !line.startsWith('|') || processedLines.filter(l => l && l.includes('<tr')).length === 0;
          const cellTag = isHeaderRow ? 'th' : 'td';
          const cellStyle = isHeaderRow ?
            'padding: 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid rgba(148, 163, 184, 0.4); color: #f7f9ff;' :
            'padding: 0.75rem; text-align: left; border-bottom: 1px solid rgba(148, 163, 184, 0.2); color: #e2e8f0;';

          return `<tr style="background: ${isHeaderRow ? 'rgba(30, 41, 59, 0.5)' : 'transparent'};">${cells.map(cell => `<${cellTag} style="${cellStyle}">${escapeHtml(cell)}</${cellTag}>`).join('')}</tr>`;
        }
      }

      // Handle bold text **text** (process first, more specific)
      line = line.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600;">$1</strong>');

      // Handle italic text *text* or _text_
      line = line.replace(/\*([^*]+)\*/g, '<em style="font-style: italic;">$1</em>');
      line = line.replace(/_([^_]+)_/g, '<em style="font-style: italic;">$1</em>');

      // Handle inline code `code`
      line = line.replace(/`([^`]+)`/g, '<code style="background: rgba(148, 163, 184, 0.1); padding: 0.125rem 0.25rem; border-radius: 3px; font-family: \'Monaco\', \'Menlo\', \'Ubuntu Mono\', monospace; font-size: 0.9em;">$1</code>');

      // Handle links [text](url)
      line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #60a5fa; text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>');

      // Handle numbered lists
      if (/^\d+\.\s/.test(line)) {
        const content = line.replace(/^\d+\.\s/, '');
        return `<li style="margin-bottom: 0.5rem; margin-left: 1.5rem;">${content}</li>`;
      }

      // Handle bullet points
      if (/^[-*+]\s/.test(line)) {
        const content = line.substring(2);
        return `<li style="margin-bottom: 0.5rem; margin-left: 1.5rem; list-style-type: disc;">${content}</li>`;
      }

      // Handle blockquotes
      if (line.trim().startsWith('>')) {
        const content = line.trim().substring(1).trim();
        return `<blockquote style="border-left: 3px solid rgba(148, 163, 184, 0.5); padding-left: 1rem; margin: 1rem 0; color: #94a3b8; font-style: italic;">${content}</blockquote>`;
      }

      // Regular paragraph (non-empty)
      if (line.trim()) {
        return `<p style="margin-bottom: 1rem; line-height: 1.6;">${line}</p>`;
      }

      return '';
    }).filter(line => line !== null); // Remove null lines (filtered headers)

    // Wrap consecutive table rows in <table> tags
    const result = [];
    let inTable = false;
    let tableRows = [];

    for (const line of processedLines) {
      if (line.includes('<tr')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        tableRows.push(line);
      } else {
        if (inTable) {
          // Close the table
          result.push(`<table style="width: 100%; border-collapse: collapse; margin: 1.5rem 0; background: rgba(15, 23, 42, 0.3); border-radius: 8px; overflow: hidden;"><tbody>${tableRows.join('\n')}</tbody></table>`);
          inTable = false;
          tableRows = [];
        }
        result.push(line);
      }
    }

    // Handle case where table is at the end
    if (inTable && tableRows.length > 0) {
      result.push(`<table style="width: 100%; border-collapse: collapse; margin: 1.5rem 0; background: rgba(15, 23, 42, 0.3); border-radius: 8px; overflow: hidden;"><tbody>${tableRows.join('\n')}</tbody></table>`);
    }

    return result.join('\n');
  }

  // Helper function to escape HTML special characters
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Filter content to remove metadata and the tags section but preserve
  // everything else in the markdown file. The previous implementation sliced
  // between the description header and the first "## Tags", which meant any
  // additional sections following tags (e.g. appendices) were dropped, and
  // headers inside the description could prematurely truncate the text.  We
  // now strip only the #/## headers used for metadata and delete the tags block
  // without cutting off subsequent content.
  function filterDescriptionContent(content, nodeTitle) {
    if (!content) return '';

    const lines = content.split('\n');
    const filtered = [];
    let skippingTags = false;
    let foundFirstH1 = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle H1 title - skip if it matches the node title (prevent duplication)
      if (!foundFirstH1 && /^#\s+/.test(line)) {
        foundFirstH1 = true;
        const h1Text = line.replace(/^#\s+/, '').trim();
        if (h1Text.toLowerCase() === (nodeTitle || '').toLowerCase()) {
          continue; // Skip this H1 as it matches the tile/article title
        }
      }

      // drop metadata lines
      if (/^\*\*ID:/i.test(line)) continue;
      if (/^\*\*Path:/i.test(line)) continue;
      if (/^\*\*Branch:/i.test(line)) continue;

      // detect tags block
      if (/^##\s+Tags\b/i.test(line)) {
        skippingTags = true;
        continue;
      }
      // if we were skipping tags and hit another header, stop skipping
      if (skippingTags && /^##\s+/.test(line)) {
        skippingTags = false;
        // proceed to include this new header
      }
      if (skippingTags) {
        continue; // skip lines inside tags block
      }
      filtered.push(line);
    }

    return filtered.join('\n').trim();
  }

  useEffect(() => {
    if (!descriptionRef) {
      setFullDescription('');
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/tree/description/${encodeURIComponent(descriptionRef)}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load description: ${response.status}`);
        }
        return response.text();
      })
      .then(content => {
        // Filter content to show only description section, passing nodeTitle to prevent duplicate titles
        const filteredContent = filterDescriptionContent(content, nodeTitle);
        // Render markdown to HTML
        const renderedContent = renderMarkdown(filteredContent);
        setFullDescription(renderedContent);
      })
      .catch(err => {
        console.error('Error loading full description:', err);
        setError(err.message);
        // Fallback to empty string if loading fails
        setFullDescription('');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [descriptionRef]);

  return { fullDescription, loading, error };
}

// User Card Component with finance context
function UserCard({ userAccount, onToggleAccount, isAccountOpen }) {
  const user = userAccount.getUserData();
  const pfpEmojis = {
    null: '👤',
    finance1: '💹',
    finance2: '💰',
    finance3: '🏦',
    finance4: '📊',
    finance5: '📑'
  };
  const emoji = pfpEmojis[user.pfp] || '👤';
  
  // Get display name - prioritize Google displayName, then username, then email prefix
  const displayName = user.displayName || user.username || 
    (user.email ? user.email.split('@')[0] : null) || 'Set your nickname';
  
  // Check if user needs to set up profile
  const needsSetup = !user.username || user.username === 'crypto.explorer' || user.username === 'Guest';
  
  // Get role display with proper capitalization
  const roleDisplay = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';

  return (
    <div className={`user-card ${isAccountOpen ? 'user-card--active' : ''}`} onClick={onToggleAccount}>
      <div className="user-avatar" style={{ fontSize: user.pfp ? '1.5rem' : '1rem' }}>
        {emoji}
      </div>
      <div className="user-meta">
        <div className="user-name">
          {displayName}
          {needsSetup && (
            <span style={{ 
              marginLeft: '8px', 
              fontSize: '0.75rem', 
              color: '#38bdf8',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              → Set nickname
            </span>
          )}
        </div>
        <div className="user-settings-link">Portfolio & Financial Settings</div>
        <div className="user-role">{roleDisplay}</div>
        {user.preferences?.careerTrack && (
          <div className="user-career" style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
            {user.preferences.careerTrack.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </div>
        )}
        {user.preferences?.netWorthGoalAt30 && (
          <div className="user-goal" style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
            Goal by 30: ${(user.preferences.netWorthGoalAt30 / 1000000).toFixed(1)}M
          </div>
        )}
        {user.preferences?.riskProfile && (
          <div className="user-risk" style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
            Risk: {user.preferences.riskProfile.charAt(0).toUpperCase() + user.preferences.riskProfile.slice(1)}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuWheel({ onToggle }) {
  return (
    <button className="menu-wheel-button" onClick={onToggle}>
      <div className="menu-wheel-icon">
        <div className="menu-wheel-dot" />
      </div>
    </button>
  );
}

// Navigation Exit Helper Component
function NavExitButtons({ onGoHome, onGoToTree, currentScreen }) {
  return (
    <div className="nav-exit-buttons">
      {currentScreen !== 'home' && (
        <button className="nav-exit-btn" onClick={onGoHome}>
          ← Home
        </button>
      )}
    </div>
  );
}

function NavOverlay({ onClose, onNavigate, currentScreen, isOpen }) {
  const [adminItems, setAdminItems] = useState([]);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    // Only check admin status when overlay is opened
    if (!isOpen) {
      setAdminItems([]);
      return;
    }
    
    const checkAdminStatus = async () => {
      setIsCheckingAdmin(true);
      try {
        if (typeof AdminUtils !== 'undefined' && AdminUtils.isAdmin) {
          const isAdminUser = await AdminUtils.isAdmin();
          console.log('[NavOverlay] Admin check result:', isAdminUser);
          if (isAdminUser) {
            setAdminItems([
              { id: 'admin-article', label: 'New Article', pill: 'Admin' },
              { id: 'admin-suggestions', label: 'Suggestions', pill: 'Admin' },
              { id: 'admin-users', label: 'View Users', pill: 'Admin' }
            ]);
          } else {
            setAdminItems([]);
          }
        } else {
          console.warn('[NavOverlay] AdminUtils not available');
          setAdminItems([]);
        }
      } catch (error) {
        console.error('[NavOverlay] Error checking admin status:', error);
        setAdminItems([]);
      } finally {
        setIsCheckingAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [isOpen]);

  const items = [
    { id: 'tree', label: 'Tree CryptoMap', pill: 'Map' },
    { id: 'my-insights', label: 'MyInsights', pill: 'Research' },
    { id: 'level-up', label: 'Level Up', pill: 'Learn' },
    { id: 'new', label: 'New Branch', pill: 'Tiles' },
    { id: 'favorite', label: 'Favorite', pill: 'Bookmarks' },
    { id: 'explore', label: 'Explore', pill: 'Tags' },
    { id: 'contribute', label: 'Contribute', pill: 'Help' }
  ];

  return (
    <div className="nav-overlay" onClick={onClose}>
      <div className="nav-panel" onClick={e => e.stopPropagation()}>
        <div className="nav-title">Navigate</div>
        <div className="nav-items">
          {items.map(item => (
            <div key={item.id} className="nav-item" onClick={() => { onNavigate(item.id); onClose(); }}>
              <span className="nav-item-label">{item.label}</span>
              <span className="nav-item-pill">{item.pill}</span>
            </div>
          ))}
          {adminItems.length > 0 && (
            <>
              <div className="nav-divider"></div>
              {adminItems.map(item => (
                <div key={item.id} className="nav-item nav-item--admin" onClick={() => { onNavigate(item.id); onClose(); }}>
                  <span className="nav-item-label">{item.label}</span>
                  <span className="nav-item-pill">{item.pill}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced Home Screen with algorithms
function HomeScreen({ userAccount, bookmarksApi, onOpenAccount, onNavigateToTree, onOpenArticle, onNavigateToMyInsights, tree }) {
  const activities = userAccount.getActivitiesSummary();
  const bookmarks = bookmarksApi.bookmarks.slice(0, 3);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  const [dailyBranch, setDailyBranch] = useState(null);

  // Check admin status on mount (server-verified)
  useEffect(() => {
    const checkAdmin = async () => {
      setAdminLoading(true);
      try {
        // Use AdminUtils for server-side verification
        if (typeof AdminUtils !== 'undefined' && AdminUtils.isAdmin) {
          const adminStatus = await AdminUtils.isAdmin();
          setIsAdmin(adminStatus);
        } else {
          // Fallback to sync check (will return false until server verification)
          setIsAdmin(userAccount.isAdminSync ? userAccount.isAdminSync() : false);
        }
      } catch (error) {
        console.error('[HomeScreen] Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setAdminLoading(false);
      }
    };
    
    checkAdmin();
  }, []);

  // Select a random core branch every 24 hours
  useEffect(() => {
    const selectDailyBranch = () => {
      if (!tree || !tree.fields || tree.fields.length === 0) return;
      
      // Get core branches (top-level fields)
      const coreBranches = tree.fields.filter(f => f && f.id && f.name);
      if (coreBranches.length === 0) return;
      
      // Check if we already have a stored branch for today
      const storedData = localStorage.getItem('dailyBranchData');
      const today = new Date().toDateString();
      
      if (storedData) {
        const { date, branchId } = JSON.parse(storedData);
        if (date === today) {
          // Use the stored branch if it's from today
          const storedBranch = coreBranches.find(b => b.id === branchId);
          if (storedBranch) {
            setDailyBranch(storedBranch);
            return;
          }
        }
      }
      
      // Select a new random branch
      const randomIndex = Math.floor(Math.random() * coreBranches.length);
      const newBranch = coreBranches[randomIndex];
      
      // Store for today
      localStorage.setItem('dailyBranchData', JSON.stringify({
        date: today,
        branchId: newBranch.id
      }));
      
      setDailyBranch(newBranch);
    };
    
    selectDailyBranch();
  }, [tree]);

  // Update streak on mount
  useEffect(() => {
    userAccount.updateStreak();
  }, []);

  // Get today's focus or suggest one from bookmarks
  const todaysFocus = activities.todaysFocus || (bookmarks.length > 0 ? {
    id: bookmarks[0].id,
    name: bookmarks[0].name,
    path: bookmarks[0].path
  } : null);

  // Set today's focus if it doesn't exist
  useEffect(() => {
    if (!activities.todaysFocus && bookmarks.length > 0) {
      userAccount.setTodaysFocus(bookmarks[0]);
    }
  }, []);

  const navigateToMyInsights = () => {
    onNavigateToMyInsights && onNavigateToMyInsights();
  };

  return (
    <div className="screen">
      {/* Admin indicator removed - no longer allows local toggle */}

      <UserCard userAccount={userAccount} onToggleAccount={onOpenAccount} isAccountOpen={false} />

      <div className="home-highlights">
        <div className="card" onClick={() => todaysFocus && onOpenArticle(todaysFocus)} style={{ cursor: todaysFocus ? 'pointer' : 'default' }}>
          <div className="card-title">Today&apos;s Focus</div>
          <div className="card-main">{todaysFocus ? todaysFocus.name : 'No focus set'}</div>
          <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#9ca3af' }}>
            {todaysFocus ? 'Continue exploring this topic' : 'Set a focus from your bookmarks'}
          </p>
        </div>

        <div className="card">
          <div className="card-title">Streak</div>
          <div className="card-main">{activities.streakDays} {activities.streakDays === 1 ? 'day' : 'days'}</div>
          <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#9ca3af' }}>
            Keep exploring one new concept per day
          </p>
        </div>

        <div className="card" onClick={() => bookmarks.length > 0 && onNavigateToTree()} style={{ cursor: bookmarks.length > 0 ? 'pointer' : 'default' }}>
          <div className="card-title">Bookmarks</div>
          <div className="card-main">{bookmarksApi.bookmarks.length} saved</div>
          <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#9ca3af' }}>
            {bookmarks.length > 0 ? 'Quick access to your favorites' : 'Bookmark articles to access them quickly'}
          </p>
        </div>
      </div>

      {/* Daily Core Branch Section */}
      {dailyBranch && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ 
            background: 'linear-gradient(145deg, rgba(56, 189, 248, 0.1), rgba(14, 165, 233, 0.05))',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => onOpenArticle(dailyBranch)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, rgba(56, 189, 248, 0.1), rgba(14, 165, 233, 0.05))';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🌟</span>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#38bdf8' }}>
                Today&apos;s Core Branch
              </span>
            </div>
            <h3 style={{ marginBottom: '0.5rem', color: '#f7f9ff' }}>{dailyBranch.name}</h3>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
              {dailyBranch.description ? 
                (dailyBranch.description.length > 100 ? dailyBranch.description.substring(0, 100) + '...' : dailyBranch.description)
                : 'Explore this core finance topic today'}
            </p>
          </div>
        </div>
      )}

      {/* MyInsights Section */}
      <div style={{ marginTop: '2rem' }}>
        <div 
          onClick={navigateToMyInsights}
          style={{
            background: 'rgba(167, 139, 250, 0.1)',
            border: '1px solid rgba(167, 139, 250, 0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(167, 139, 250, 0.2)';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(167, 139, 250, 0.1)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💎</div>
          <h3 style={{ marginBottom: '0.5rem', color: '#f7f9ff' }}>MyInsights</h3>
          <p style={{ color: '#94a3b8', margin: 0 }}>Exclusive research and market materials</p>
        </div>
      </div>

      {bookmarks.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Recent Bookmarks</h3>
          <div className="bookmarks-list">
            {bookmarks.map(b => (
              <div key={b.id} className="bookmarks-list-item" onClick={() => onOpenArticle(b)}>
                <div>
                  <div className="search-result-name">{b.name}</div>
                  <div className="search-result-path">{b.path ? pathToString(b.path) : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Ensure fallback data exists
if (!window.cryptoHustleTree) {
  window.cryptoHustleTree = { fields: [] };
}

function FallbackMyInsightsScreen({ onGoHome }) {
  return (
    <div className="screen" style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>MyInsights</h2>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💎</div>
        <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
          MyInsights component is loading...
        </p>
      </div>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="secondary-button" onClick={onGoHome}>
          ← Home
        </button>
      </div>
    </div>
  );
}

function getMyInsightsScreen() {
  try {
    if (window.MyInsightsScreen && typeof window.MyInsightsScreen === 'function') {
      return window.MyInsightsScreen;
    }
  } catch (error) {}
  return FallbackMyInsightsScreen;
}

// Fallback components for LevelUp if not loaded
function FallbackLevelUpScreen({ onGoHome, onGoToTree }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const handleRetry = () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    setTimeout(() => {
      if (window.LevelUpScreen && typeof window.LevelUpScreen === 'function') {
        setIsRetrying(false);
      } else {
        setIsRetrying(false);
      }
    }, 1000);
  };
  
  return (
    <div className="screen" style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Level Up</h2>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
        <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
          The Level Up component is loading...
        </p>
        <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          Retry attempts: {retryCount}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button 
          className="primary-button" 
          onClick={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? 'Retrying...' : 'Retry Loading'}
        </button>
        <button className="secondary-button" onClick={onGoHome}>
          ← Home
        </button>
      </div>
    </div>
  );
}

function getLevelUpScreen() {
  try {
    if (window.LevelUpScreen && typeof window.LevelUpScreen === 'function') {
      console.log('Using loaded LevelUpScreen');
      return window.LevelUpScreen;
    }
  } catch (error) {
    console.error('Error accessing LevelUpScreen:', error);
  }
  console.log('Using fallback LevelUpScreen');
  return FallbackLevelUpScreen;
}

// Tree Screen - Use external TreeScreen component
// TreeScreen is loaded from TreeScreen.js file

function ArticleScreen({ node, onBackToTree, bookmarksApi, userAccount, onGoHome, onOpenArticle }) {
  if (!node) {
    console.error('ArticleScreen: No node provided');
    return (
      <div className="screen" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="secondary-text">Article not found</div>
        <button className="primary-button" onClick={onGoHome}>← Back to Home</button>
      </div>
    );
  }

  // Ensure node has required properties with defaults
  const safeNode = {
    id: node.id || 'unknown',
    name: node.name || 'Untitled',
    description: node.description || 'No description available',
    tags: Array.isArray(node.tags) ? node.tags : [],
    path: Array.isArray(node.path) ? node.path : [],
    ...node
  };

  // Admin status state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  // Check admin status on mount
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        if (typeof AdminUtils !== 'undefined' && AdminUtils.isAdmin) {
          const adminStatus = await AdminUtils.isAdmin();
          setIsAdmin(adminStatus);
        } else {
          setIsAdmin(userAccount.isAdminSync ? userAccount.isAdminSync() : false);
        }
      } catch (error) {
        console.error('[ArticleScreen] Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setAdminChecked(true);
      }
    };
    
    checkAdmin();
  }, []);

  // Load full description from markdown file
  const { fullDescription, loading, error } = useFullDescription(safeNode.descriptionRef, safeNode.name);

  // Quiz tag scan: look for [QUIZ_ID: some_id] in markdown-derived description HTML or fallback content
  const quizId = useMemo(() => {
    try {
      const sources = [
        typeof fullDescription === 'string' ? fullDescription : '',
        typeof safeNode.description === 'string' ? safeNode.description : '',
        typeof safeNode.content === 'string' ? safeNode.content : ''
      ];
      const combined = sources.filter(Boolean).join('\n');
      const m = combined.match(/\[\s*QUIZ_ID\s*:\s*([a-zA-Z0-9_-]+)\s*\]/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }, [fullDescription, safeNode.description, safeNode.content]);

  useEffect(() => {
    userAccount.recordArticleRead(safeNode);
  }, [safeNode.id]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.NotificationsClient && typeof window.NotificationsClient.recordArticleRead === 'function') {
        const url = typeof window.location !== 'undefined' ? window.location.href : '/';
        window.NotificationsClient.recordArticleRead({
          articleId: safeNode.id,
          articleTitle: safeNode.name,
          quizId: quizId,
          url
        }).catch(() => {});
      }
    } catch {}
  }, [safeNode.id, quizId]);

  const flatNodes = useMemo(() => {
    try {
      if (typeof window !== 'undefined' && window.TreeUtils && typeof window.TreeUtils.flattenTree === 'function') {
        const getChildren = window.TreeUtils.getChildren;
        return window.TreeUtils.flattenTree(window.cryptoHustleTree || { fields: [] }, getChildren);
      }
    } catch {}
    return flattenTree(window.cryptoHustleTree?.fields || []);
  }, []);

  // Build full hierarchical path from prime tile to current tile
  const fullTilePath = useMemo(() => {
    return buildFullTilePath(safeNode, flatNodes);
  }, [safeNode, flatNodes]);

  const fullPath = safeNode.path && safeNode.path.length > 0 ? 
    pathToString(safeNode.path) + ' / ' + safeNode.name : 
    safeNode.name;

  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullTilePath).catch(() => {});
    }
  }

  function handleDelete() {
    if (window.confirm(`Are you sure you want to delete "${safeNode.name}"? This action cannot be undone.`)) {
      if (typeof window.AdminUtils !== 'undefined') {
        const deleteResult = window.AdminUtils.deleteArticleFromTree(safeNode.id, window.cryptoHustleTree);
        if (deleteResult.success) {
          alert('Article deleted successfully!');
          onBackToTree(); // Go back to tree after deletion
        } else {
          alert('Error deleting article: ' + (deleteResult.error || 'Unknown error'));
        }
      } else {
        alert('Delete functionality not available. Admin utilities not loaded.');
      }
    }
  }

  // Reconstruct full path from flatNodes
  const nodeWithFullPath = useMemo(() => {
    const found = flatNodes.find(n => n.id === safeNode.id);
    return found || safeNode;
  }, [flatNodes, safeNode.id]);

  // Update fullPath with enhanced path from flatNodes if available
  const enhancedFullPath = nodeWithFullPath.fullPath ? 
    nodeWithFullPath.fullPath.join(' / ') : 
    fullPath;

  // Get related articles at same hierarchy level
  const relatedArticles = useMemo(() => {
    if (!nodeWithFullPath.path || nodeWithFullPath.path.length === 0) return [];
    
    const currentLevel = nodeWithFullPath.path[nodeWithFullPath.path.length - 1];
    if (!currentLevel) return [];
    
    return flatNodes.filter(n => 
      n.path && 
      Array.isArray(n.path) &&
      n.path.length === nodeWithFullPath.path.length &&
      n.path[n.path.length - 1]?.id === currentLevel.id &&
      n.id !== safeNode.id
    ).slice(0, 4);
  }, [nodeWithFullPath, flatNodes, safeNode.id]);

  return (
    <div className="screen">
      <NavExitButtons currentScreen="article" onGoHome={onGoHome} onGoToTree={onBackToTree} />
      <div className="article-header">
        <div className="article-category">{safeNode.kind ? safeNode.kind.toUpperCase() : 'SECTION'}</div>
        <div className="article-title">{safeNode.name}</div>
        <div className="article-path">
          <span className="article-path-code">{fullTilePath}</span>
          <button className="copy-button" onClick={handleCopy}>Copy path</button>
          {adminChecked && isAdmin && (
            <button className="delete-button" onClick={handleDelete} style={{ marginLeft: '0.5rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171' }}>Delete Article</button>
          )}
        </div>
        <div className="tags-row">
          {safeNode.tags.map(tag => (
            <span key={tag} className="tag-pill">{tag}</span>
          ))}
        </div>
        
        {/* Contribution Attribution Badge */}
        {(safeNode.author || safeNode.isContribution) && (
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem 0.75rem',
              background: 'rgba(34, 197, 94, 0.2)',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              color: '#22c55e',
              fontWeight: '600'
            }}>
              <span>📝</span> Community Contribution
            </span>
            
            {safeNode.author && (
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Author: <strong style={{ color: '#f7f9ff' }}>{safeNode.author.nickname || safeNode.author.username}</strong>
              </span>
            )}
            
            {safeNode.reviewedBy && (
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Approved by: <strong style={{ color: '#f7f9ff' }}>{safeNode.reviewedBy.nickname || safeNode.reviewedBy.username}</strong>
              </span>
            )}
            
            {safeNode.editedBy && safeNode.editedBy.username !== safeNode.reviewedBy?.username && (
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Edited by: <strong style={{ color: '#f7f9ff' }}>{safeNode.editedBy.nickname || safeNode.editedBy.username}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="article-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>📖</div>
            Loading full description...
          </div>
        ) : error ? (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>⚠️ Error Loading Description</div>
            <div>{error}</div>
            <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#94a3b8' }}>
              Fallback: {safeNode.content || safeNode.description}
            </div>
          </div>
        ) : (
          <div className="article-content">
            {fullDescription ? (
              <div dangerouslySetInnerHTML={{ __html: fullDescription }} />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {safeNode.content || safeNode.description}
              </div>
            )}

            {quizId && window.QuizEngine && typeof window.QuizEngine.QuizWidget === 'function' ? (
              <div style={{ marginTop: '2rem' }}>
                <window.QuizEngine.QuizWidget quizId={quizId} />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Related Articles Widget */}
      {relatedArticles.length > 0 && (
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '12px',
          border: '1px solid rgba(148, 163, 184, 0.3)'
        }}>
          <h4 style={{ marginBottom: '1rem', color: '#f7f9ff' }}>Related Articles</h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            {relatedArticles.map(article => (
              <div
                key={article.id}
                onClick={() => onOpenArticle && onOpenArticle(article)}
                style={{
                  padding: '1rem',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(56, 189, 248, 0.2)';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(56, 189, 248, 0.1)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: '#f7f9ff'
                }}>
                  {article.name}
                </div>
                <div style={{
                  fontSize: '0.85rem',
                  color: '#94a3b8',
                  lineHeight: '1.4'
                }}>
                  {article.description?.substring(0, 80)}{article.description?.length > 80 ? '...' : ''}
                </div>
                {(article.tags || []).slice(0, 2).map(tag => (
                  <span key={tag} style={{
                    display: 'inline-block',
                    background: 'rgba(148, 163, 184, 0.2)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    marginTop: '0.5rem',
                    marginRight: '0.25rem'
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="article-footer">
        <button className="primary-button" onClick={onBackToTree}>
          ← Back to CryptoMap Tree
        </button>
        <button
          className={`bookmark-toggle ${bookmarksApi.isBookmarked(safeNode.id) ? 'bookmark-toggle--active' : ''}`}
          onClick={() => bookmarksApi.toggleBookmark(safeNode)}
        >
          {bookmarksApi.isBookmarked(safeNode.id) ? 'Bookmarked' : 'Bookmark'}
        </button>
      </div>
    </div>
  );
}

// Use external components if available
const FavoritesScreen = (() => {
  if (window.FavoritesScreen && typeof window.FavoritesScreen === 'function') {
    return window.FavoritesScreen;
  }
  // Fallback inline version
  return function({ bookmarks, onOpenArticle, onGoHome, onGoToTree }) {
    const handleBookmarkClick = (bookmark) => {
      onGoToTree();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('navigateToBookmark', {
          detail: { nodeId: bookmark.id }
        }));
      }, 300);
    };

    return (
      <div className="screen">
        <NavExitButtons currentScreen="favorites" onGoHome={onGoHome} onGoToTree={onGoToTree} />
        <h2 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Favorites</h2>
        <div className="secondary-text">Bookmarked sections from your CryptoMap tree.</div>
        <div className="bookmarks-list">
          {bookmarks.length === 0 ? (
            <div className="secondary-text" style={{ marginTop: '1rem' }}>
              No bookmarks yet. Use the &quot;Bookmark&quot; buttons in search results or articles.
            </div>
          ) : (
            bookmarks.map(b => (
              <div key={b.id} className="bookmarks-list-item" onClick={() => handleBookmarkClick(b)}>
                <div>
                  <div className="search-result-name">{b.name}</div>
                  <div className="search-result-path">{b.path ? pathToString(b.path) : ''}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };
})();

const ExploreScreen = (() => {
  if (window.ExploreScreen && typeof window.ExploreScreen === 'function') {
    return window.ExploreScreen;
  }
  // Fallback inline version
  return function({ tree, onOpenArticle, onGoHome, onGoToTree }) {
    const flatNodes = useMemo(() => flattenTree(tree.fields || []), [tree]);
    const tagIndex = useMemo(() => {
      const map = new Map();
      flatNodes.forEach(n => {
        (n.tags || []).forEach(t => {
          const norm = t.toLowerCase();
          if (!map.has(norm)) map.set(norm, { tag: t, nodes: [] });
          map.get(norm).nodes.push(n);
        });
      });
      return Array.from(map.values()).sort((a, b) => a.tag.localeCompare(b.tag));
    }, [flatNodes]);

    return (
      <div className="screen">
        <NavExitButtons currentScreen="explore" onGoHome={onGoHome} onGoToTree={onGoToTree} />
        <h2 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explore by tags</h2>
        <div className="secondary-text">Discover sections grouped by learning themes.</div>
        <div style={{ marginTop: '1.25rem' }}>
          {tagIndex.map(entry => (
            <div key={entry.tag} style={{ marginBottom: '1rem' }}>
              <div className="tag-pill">{entry.tag}</div>
              {entry.nodes.map(n => (
                <div key={n.id} className="search-result-item">
                  <div onClick={() => onOpenArticle(n)}>
                    <div className="search-result-name">{n.name}</div>
                    <div className="search-result-path">{pathToString(n.path)}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };
})();

// New Section Screen
function NewScreen({ tree, onOpenArticle, onGoHome, onGoToTree }) {
  const latestTiles = useMemo(() => {
    const sourceTree = tree || (typeof window !== 'undefined' ? window.cryptoHustleTree : null);
    const flat = flattenTree(sourceTree?.fields || []);

    // Prefer explicit recency signals if present.
    const hasTemporal = flat.some(n => n.timestamp || n.createdAt || n.updatedAt || n.publication_date);
    const withScore = flat.map((n, idx) => {
      const t = n.timestamp || n.updatedAt || n.createdAt || n.publication_date;
      const timeMs = typeof t === 'number'
        ? t * (t > 1e12 ? 1 : 1000)
        : (t && typeof t.toDate === 'function')
          ? t.toDate().getTime()
          : (typeof t === 'string')
            ? Date.parse(t)
            : NaN;

      return {
        node: n,
        timeMs: Number.isFinite(timeMs) ? timeMs : null,
        idx,
      };
    });

    const sorted = hasTemporal
      ? withScore.sort((a, b) => (b.timeMs || -Infinity) - (a.timeMs || -Infinity) || (b.idx - a.idx))
      : withScore.sort((a, b) => b.idx - a.idx);

    return sorted
      .map(x => x.node)
      .filter(n => n && n.id && n.name)
      .slice(0, 16);
  }, [tree]);

  return (
    <div className="screen">
      <NavExitButtons currentScreen="new" onGoHome={onGoHome} onGoToTree={onGoToTree} />
      <h2 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>New Branch</h2>
      <div className="secondary-text">Latest tiles added to the Tree.</div>

      <div style={{ marginTop: '1.5rem' }}>
        {latestTiles.length === 0 ? (
          <div className="secondary-text">No tiles found. Load the Tree first.</div>
        ) : (
          latestTiles.map(node => (
            <div
              key={node.id}
              className="new-item"
              onClick={() => onOpenArticle(node)}
              style={{ cursor: 'pointer' }}
            >
              <div className="new-item-header">
                <span className="new-item-badge">Tile</span>
                <span className="new-item-date">{node.publication_date || ''}</span>
              </div>
              <div className="new-item-title">{node.name}</div>
              {node.description ? (
                <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#9ca3af', lineHeight: 1.35 }}>
                  {String(node.description).length > 120 ? String(node.description).slice(0, 120) + '…' : String(node.description)}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Contribute Section Screen
function ContributeScreen({ tree, onGoHome, onGoToTree }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [customSegment, setCustomSegment] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [saved, setSaved] = useState(false);

  const flatNodes = useMemo(() => flattenTree(tree.fields || []), [tree]);

  function handleSubmit() {
    if (!title.trim() || !description.trim() || !body.trim() || (!segmentId && !customSegment.trim())) {
      alert('Please fill in all required fields.');
      return;
    }

    if (typeof ContributeSave !== 'undefined') {
      // Get selected node info for segment path
      const selectedNode = flatNodes.find(n => n.id === segmentId);
      const segmentPath = selectedNode ? selectedNode.path : null;

      const result = ContributeSave.saveContribution({
        title: title.trim(),
        description: description.trim(),
        body: body.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        segmentId: segmentId || 'custom',
        segmentPath: segmentPath,
        customSegment: customSegment.trim() || null,
        locationType: showCustom ? 'custom' : 'existing'
      });

      if (result.success) {
        setSaved(true);
        setTimeout(() => {
          setShowForm(false);
          setTitle('');
          setDescription('');
          setBody('');
          setTags('');
          setSegmentId('');
          setCustomSegment('');
          setShowCustom(false);
          setSaved(false);
        }, 3000);
      }
    } else {
      alert('Contribution system not available');
    }
  }

  return (
    <div className="screen">
      <NavExitButtons currentScreen="contribute" onGoHome={onGoHome} onGoToTree={onGoToTree} />
      <h2 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Contribute</h2>
      <div className="secondary-text" style={{ marginBottom: '1.5rem' }}>
        Your suggestions help improve OntyFi. Share your ideas, report issues, or propose new content sections.
      </div>

      {!showForm ? (
        <button className="primary-button" onClick={() => setShowForm(true)} style={{ marginTop: '1rem' }}>
          Contribute
        </button>
      ) : (
        <div className="contribute-form">
          {saved && (
            <div className="success-message congratulations-message">
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎉</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Congratulations & Thanks for contributing!
              </div>
              <div style={{ marginBottom: '1rem' }}>
                Your suggestion has been saved and will help improve OntyFi for everyone.
              </div>
              <button 
                className="primary-button" 
                onClick={() => {
                  setShowForm(false);
                  setTitle('');
                  setDescription('');
                  setBody('');
                  setTags('');
                  setSegmentId('');
                  setCustomSegment('');
                  setShowCustom(false);
                  setSaved(false);
                }}
                style={{ marginTop: '1rem' }}
              >
                Back Home
              </button>
            </div>
          )}
          
          <div className="form-item">
            <label className="form-label">Title *</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Article title for your suggestion"
            />
          </div>

          <div className="form-item">
            <label className="form-label">Short Description *</label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the article..."
              rows="2"
            />
          </div>

          <div className="form-item">
            <label className="form-label">Tags (comma-separated)</label>
            <input
              type="text"
              className="form-input"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="form-item">
            <label className="form-label">Full Article Content *</label>
            <textarea
              className="form-textarea"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write the full article content here..."
              rows="8"
            />
          </div>

          <div className="form-item">
            <label className="form-label">Related Section</label>
            {!showCustom ? (
              <>
                <select
                  className="form-select"
                  value={segmentId}
                  onChange={e => setSegmentId(e.target.value)}
                >
                  <option value="">Select a section...</option>
                  {flatNodes.map(n => (
                    <option key={n.id} value={n.id}>{pathToString(n.path)} / {n.name}</option>
                  ))}
                </select>
                <button
                  className="form-button-secondary"
                  onClick={() => setShowCustom(true)}
                  style={{ marginTop: '0.5rem' }}
                >
                  Add Custom Section
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  className="form-input"
                  value={customSegment}
                  onChange={e => setCustomSegment(e.target.value)}
                  placeholder="Enter custom section name"
                />
                <button
                  className="form-button-secondary"
                  onClick={() => { setShowCustom(false); setCustomSegment(''); }}
                  style={{ marginTop: '0.5rem' }}
                >
                  Use Existing Section
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="primary-button" onClick={handleSubmit}>Send</button>
            <button className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Admin: New Article Screen
function AdminNewArticleScreen({ tree, onGoHome, onSave }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [locationType, setLocationType] = useState('existing'); // 'existing' or 'custom'
  const [customLocation, setCustomLocation] = useState('');
  const [images, setImages] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [bodySections, setBodySections] = useState([]);
  const flatNodes = useMemo(() => flattenTree(tree.fields || []), [tree]);

  // Parse body sections when body changes
  useEffect(() => {
    const sections = [];
    const parts = body.split('[IMAGE]');
    parts.forEach((part, index) => {
      if (part.trim()) {
        sections.push({ type: 'text', content: part.trim() });
      }
      if (index < parts.length - 1) {
        sections.push({ type: 'image', content: null, imageIndex: index });
      }
    });
    setBodySections(sections);
  }, [body]);

  function handleImageAdd(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target.result;
        setImages([...images, { id: Date.now(), file, url }]);
        setImageUrls([...imageUrls, url]);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleImageRemove(index) {
    setImages(images.filter((_, i) => i !== index));
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  }

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
      bodySections: bodySections,
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      images: imageUrls,
      locationType,
      targetSectionId: locationType === 'existing' ? targetSectionId : null,
      customLocation: locationType === 'custom' ? customLocation.trim() : null
    };

    console.log('Article data prepared:', articleData);

    if (typeof AdminUtils !== 'undefined') {
      console.log('AdminUtils available, calling saveArticleToTree');
      
      // Handle the promise returned by saveArticleToTree
      const savePromise = AdminUtils.saveArticleToTree(articleData, targetSectionId, tree);
      
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
        // It's a synchronous result (fallback)
        const result = savePromise;
        console.log('Save result:', result);
        if (result.success) {
          alert('Article saved successfully!');
          onSave && onSave();
        } else {
          alert('Error saving article: ' + (result.error || 'Unknown error'));
        }
      }
    } else {
      console.error('AdminUtils not available');
      alert('Admin utilities not available');
    }
  }

  return (
    <div className="screen">
      <NavExitButtons currentScreen="admin-article" onGoHome={onGoHome} />
      <h2 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>New Article (Admin)</h2>
      <div className="secondary-text" style={{ marginBottom: '1.5rem' }}>
        Create and publish a new article section
      </div>

      <div className="admin-article-form">
        <div className="form-item">
          <label className="form-label">Title *</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Article title"
          />
        </div>

        <div className="form-item">
          <label className="form-label">Description *</label>
          <textarea
            className="form-textarea"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description"
            rows="2"
          />
        </div>

        <div className="form-item">
          <label className="form-label">Tags (comma-separated)</label>
          <input
            type="text"
            className="form-input"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="tag1, tag2, tag3"
          />
        </div>

        <div className="form-item">
          <label className="form-label">Location Type *</label>
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ marginRight: '1rem' }}>
              <input
                type="radio"
                name="locationType"
                checked={locationType === 'existing'}
                onChange={() => setLocationType('existing')}
              />
              {' '}Add to Existing Section
            </label>
            <label>
              <input
                type="radio"
                name="locationType"
                checked={locationType === 'custom'}
                onChange={() => setLocationType('custom')}
              />
              {' '}Create Custom Location
            </label>
          </div>
        </div>

        {locationType === 'existing' ? (
          <div className="form-item">
            <label className="form-label">Target Section *</label>
            <select
              className="form-select"
              value={targetSectionId}
              onChange={e => setTargetSectionId(e.target.value)}
            >
              <option value="">Select section...</option>
              {flatNodes.map(n => (
                <option key={n.id} value={n.id}>
                  {pathToString(n.path)} / {n.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-item">
            <label className="form-label">Custom Location Name *</label>
            <input
              type="text"
              className="form-input"
              value={customLocation}
              onChange={e => setCustomLocation(e.target.value)}
              placeholder="Enter custom location name (e.g., 'DeFi Innovations')"
            />
            <div className="form-hint">This will create a new top-level section in the tree</div>
          </div>
        )}

        <div className="form-item">
          <label className="form-label">Body Content *</label>
          <textarea
            className="form-textarea"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Article content. Use [IMAGE] to insert images between paragraphs."
            rows="10"
          />
          <div className="form-hint">Tip: Type [IMAGE] where you want images inserted</div>
          
          {/* Preview of body sections */}
          {bodySections.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>Preview:</div>
              {bodySections.map((section, idx) => (
                <div key={idx} style={{ marginBottom: '0.5rem' }}>
                  {section.type === 'text' ? (
                    <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px' }}>
                      📝 {section.content.substring(0, 100)}{section.content.length > 100 ? '...' : ''}
                    </div>
                  ) : (
                    <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '4px' }}>
                      🖼️ Image {section.imageIndex + 1}
                      {imageUrls[section.imageIndex] && (
                        <img 
                          src={imageUrls[section.imageIndex]} 
                          alt={`Preview ${section.imageIndex + 1}`}
                          style={{ maxWidth: '100px', height: 'auto', marginLeft: '0.5rem', borderRadius: '4px' }}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-item">
          <label className="form-label">Images</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageAdd}
            style={{ marginBottom: '0.5rem' }}
          />
          {images.length > 0 && (
            <div className="image-preview-list">
              {images.map((img, idx) => (
                <div key={img.id} className="image-preview-item">
                  <img src={img.url} alt={`Preview ${idx + 1}`} />
                  <button onClick={() => handleImageRemove(idx)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button className="primary-button" onClick={handleSave}>Save & Publish</button>
          <button className="secondary-button" onClick={onGoHome}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Admin: Suggestions Review Screen
function AdminSuggestionsReview({ tree, onGoHome, onEditSuggestion, onPublish }) {
  const [suggestions, setSuggestions] = useState([]);
  const [filter, setFilter] = useState('pending'); // pending, approved, declined, all
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const flatNodes = useMemo(() => flattenTree(tree.fields || []), [tree]);

  useEffect(() => {
    loadSuggestions();
    
    // Listen for new suggestions
    const handleNewSuggestion = () => loadSuggestions();
    window.addEventListener('suggestionSubmitted', handleNewSuggestion);
    window.addEventListener('suggestionStatusChanged', handleNewSuggestion);
    
    return () => {
      window.removeEventListener('suggestionSubmitted', handleNewSuggestion);
      window.removeEventListener('suggestionStatusChanged', handleNewSuggestion);
    };
  }, []);

  function loadSuggestions() {
    if (typeof ContributeSave !== 'undefined') {
      const all = ContributeSave.getContributions();
      setSuggestions(all);
    }
  }

  const filteredSuggestions = useMemo(() => {
    if (filter === 'all') return suggestions;
    return suggestions.filter(s => s.status === filter);
  }, [suggestions, filter]);

  const pendingCount = useMemo(() => 
    suggestions.filter(s => s.status === 'pending').length,
  [suggestions]);

  function handleApprove(suggestion) {
    if (typeof ContributeSave !== 'undefined') {
      // If we were editing, include the edits
      const adminData = isEditing ? {
        edits: {
          title: editForm.title,
          description: editForm.description,
          body: editForm.body,
          tags: editForm.tags?.split(',').map(t => t.trim()).filter(t => t),
          segmentId: editForm.segmentId,
          customSegment: editForm.customSegment,
          locationType: editForm.locationType
        },
        editSummary: 'Admin edits before approval'
      } : {};
      
      const result = ContributeSave.updateContributionStatus(suggestion.id, 'approved', adminData);
      
      if (result.success) {
        // Convert to article and publish
        const articleData = ContributeSave.convertToArticleData(result.suggestion);
        publishArticle(articleData);
        
        setSelectedSuggestion(null);
        setIsEditing(false);
        loadSuggestions();
      }
    }
  }

  function publishArticle(articleData) {
    if (typeof AdminUtils !== 'undefined') {
      const savePromise = AdminUtils.saveArticleToTree(
        articleData,
        articleData.targetSectionId,
        tree
      );
      
      if (savePromise && typeof savePromise.then === 'function') {
        savePromise
          .then(result => {
            if (result.success) {
              alert(`Article "${articleData.title}" published successfully!\n\nAuthor: ${articleData.author?.nickname || articleData.author?.username}\nApproved by: ${articleData.reviewedBy?.nickname || articleData.reviewedBy?.username}`);
              if (onPublish) onPublish();
            }
          })
          .catch(err => {
            console.error('Error publishing:', err);
            alert('Error publishing article: ' + err.message);
          });
      }
    }
  }

  function handleDecline(suggestion) {
    setSelectedSuggestion(suggestion);
    setShowDeclineModal(true);
  }

  function confirmDecline() {
    if (typeof ContributeSave !== 'undefined' && selectedSuggestion) {
      const result = ContributeSave.updateContributionStatus(
        selectedSuggestion.id, 
        'declined',
        { reviewNotes: declineReason }
      );
      
      if (result.success) {
        setShowDeclineModal(false);
        setDeclineReason('');
        setSelectedSuggestion(null);
        setIsEditing(false);
        loadSuggestions();
      }
    }
  }

  function startEdit(suggestion) {
    setSelectedSuggestion(suggestion);
    setEditForm({
      title: suggestion.title,
      description: suggestion.description,
      body: suggestion.body,
      tags: suggestion.tags?.join(', ') || '',
      segmentId: suggestion.segmentId || '',
      customSegment: suggestion.customSegment || '',
      locationType: suggestion.locationType || 'existing'
    });
    setIsEditing(true);
  }

  function saveEdits() {
    if (typeof ContributeSave !== 'undefined' && selectedSuggestion) {
      const result = ContributeSave.updateContributionStatus(
        selectedSuggestion.id,
        selectedSuggestion.status, // Keep current status
        {
          edits: {
            title: editForm.title,
            description: editForm.description,
            body: editForm.body,
            tags: editForm.tags?.split(',').map(t => t.trim()).filter(t => t),
            segmentId: editForm.segmentId,
            customSegment: editForm.customSegment,
            locationType: editForm.locationType
          },
          editSummary: 'Admin edits'
        }
      );
      
      if (result.success) {
        setIsEditing(false);
        loadSuggestions();
        // Update selected with new data
        setSelectedSuggestion(result.suggestion);
      }
    }
  }

  function getStatusBadge(status) {
    const styles = {
      pending: { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.5)' },
      approved: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.5)' },
      declined: { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.5)' },
      editing: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.5)' }
    };
    const style = styles[status] || styles.pending;
    
    return (
      <span style={{
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`
      }}>
        {status}
      </span>
    );
  }

  return (
    <div className="screen">
      <NavExitButtons currentScreen="admin-suggestions" onGoHome={onGoHome} />
      <h2 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
        Article Suggestions
        {pendingCount > 0 && (
          <span style={{
            display: 'inline-block',
            marginLeft: '0.75rem',
            padding: '0.25rem 0.75rem',
            background: 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            borderRadius: '9999px',
            fontSize: '0.85rem',
            fontWeight: '600'
          }}>
            {pendingCount} pending
          </span>
        )}
      </h2>
      <div className="secondary-text" style={{ marginBottom: '1rem' }}>
        Review, edit, and approve user-submitted article suggestions
      </div>

      {/* Filter Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
        paddingBottom: '0.5rem'
      }}>
        {['pending', 'approved', 'declined', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: filter === f ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
              color: filter === f ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: filter === f ? '600' : '400',
              textTransform: 'capitalize'
            }}
          >
            {f}
            {f !== 'all' && (
              <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                ({suggestions.filter(s => f === 'all' || s.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {/* Suggestions List */}
        <div style={{ flex: 1, maxHeight: 'calc(100vh - 250px)', overflow: 'auto' }}>
          {filteredSuggestions.length === 0 ? (
            <div className="secondary-text" style={{ textAlign: 'center', padding: '3rem' }}>
              No {filter !== 'all' ? filter : ''} suggestions found
            </div>
          ) : (
            filteredSuggestions.map(suggestion => (
              <div
                key={suggestion.id}
                onClick={() => { setSelectedSuggestion(suggestion); setIsEditing(false); }}
                style={{
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  background: selectedSuggestion?.id === suggestion.id 
                    ? 'rgba(56, 189, 248, 0.15)' 
                    : 'rgba(15, 23, 42, 0.6)',
                  borderRadius: '12px',
                  border: `1px solid ${selectedSuggestion?.id === suggestion.id 
                    ? 'rgba(56, 189, 248, 0.5)' 
                    : 'rgba(148, 163, 184, 0.2)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ marginTop: 10, color: '#94a3b8', fontSize: '0.85rem' }}>
                    Primary Focus: {profile?.preferred_finance_field || 'Not set'}
                  </div>
                  {getStatusBadge(suggestion.status)}
                </div>
                
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                  {suggestion.description?.substring(0, 80)}
                  {suggestion.description?.length > 80 ? '...' : ''}
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>👤 {suggestion.author?.nickname || suggestion.author?.username}</span>
                  <span>📅 {new Date(suggestion.timestamp).toLocaleDateString()}</span>
                  {suggestion.segmentPath && (
                    <span>📍 {suggestion.segmentPath[suggestion.segmentPath.length - 1]?.name || suggestion.customSegment || 'Custom'}</span>
                  )}
                </div>
                
                {suggestion.editedBy && (
                  <div style={{ 
                    marginTop: '0.5rem', 
                    fontSize: '0.75rem', 
                    color: '#3b82f6',
                    fontStyle: 'italic'
                  }}>
                    ✏️ Edited by {suggestion.editedBy.nickname || suggestion.editedBy.username}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Detail / Edit Panel */}
        {selectedSuggestion && (
          <div style={{ 
            flex: 1.5, 
            maxHeight: 'calc(100vh - 250px)', 
            overflow: 'auto',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(148, 163, 184, 0.3)'
          }}>
            {/* Author Info Badge */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'rgba(56, 189, 248, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Author</div>
                <div style={{ fontWeight: '600', color: '#f7f9ff' }}>
                  {selectedSuggestion.author?.nickname || selectedSuggestion.author?.username}
                </div>
              </div>
              {selectedSuggestion.reviewedBy && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Reviewed By</div>
                  <div style={{ fontWeight: '600', color: '#f7f9ff' }}>
                    {selectedSuggestion.reviewedBy.nickname || selectedSuggestion.reviewedBy.username}
                  </div>
                </div>
              )}
              {selectedSuggestion.editedBy && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Edited By</div>
                  <div style={{ fontWeight: '600', color: '#f7f9ff' }}>
                    {selectedSuggestion.editedBy.nickname || selectedSuggestion.editedBy.username}
                  </div>
                </div>
              )}
            </div>

            {isEditing ? (
              // Edit Mode
              <>
                <div className="form-item">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.title}
                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                  />
                </div>
                
                <div className="form-item">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                  />
                </div>
                
                <div className="form-item">
                  <label className="form-label">Tags (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.tags}
                    onChange={e => setEditForm({...editForm, tags: e.target.value})}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
                
                <div className="form-item">
                  <label className="form-label">Location</label>
                  <select
                    className="form-select"
                    value={editForm.segmentId || ''}
                    onChange={e => setEditForm({...editForm, segmentId: e.target.value})}
                  >
                    <option value="">Select section...</option>
                    {flatNodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {pathToString(n.path)} / {n.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-item">
                  <label className="form-label">Body Content</label>
                  <textarea
                    className="form-textarea"
                    rows="8"
                    value={editForm.body}
                    onChange={e => setEditForm({...editForm, body: e.target.value})}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button className="primary-button" onClick={saveEdits}>
                    Save Changes
                  </button>
                  <button className="secondary-button" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              // View Mode
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Title</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#f7f9ff' }}>
                    {selectedSuggestion.title}
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Description</div>
                  <div style={{ color: '#e2e8f0' }}>{selectedSuggestion.description}</div>
                </div>
                
                {selectedSuggestion.tags?.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Tags</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {selectedSuggestion.tags.map(tag => (
                        <span key={tag} className="tag-pill">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Body</div>
                  <div style={{ 
                    padding: '1rem', 
                    background: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '300px',
                    overflow: 'auto'
                  }}>
                    {selectedSuggestion.body}
                  </div>
                </div>

                {/* Version History */}
                {selectedSuggestion.versions?.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Version History</div>
                    {selectedSuggestion.versions.map((version, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: '0.5rem',
                          marginBottom: '0.25rem',
                          background: 'rgba(15, 23, 42, 0.5)',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        <span style={{ color: '#64748b' }}>
                          {new Date(version.timestamp).toLocaleString()} • {version.author} •
                        </span>
                        <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>
                          {version.changes}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                {selectedSuggestion.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button 
                      className="primary-button" 
                      onClick={() => handleApprove(selectedSuggestion)}
                      style={{ background: '#22c55e' }}
                    >
                      ✓ Approve & Publish
                    </button>
                    <button 
                      className="secondary-button" 
                      onClick={() => startEdit(selectedSuggestion)}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="secondary-button" 
                      onClick={() => handleDecline(selectedSuggestion)}
                      style={{ borderColor: '#ef4444', color: '#ef4444' }}
                    >
                      ✕ Decline
                    </button>
                  </div>
                )}
                
                {selectedSuggestion.status !== 'pending' && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button 
                      className="secondary-button" 
                      onClick={() => startEdit(selectedSuggestion)}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1e293b',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Decline Suggestion</h3>
            <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
              Are you sure you want to decline "{selectedSuggestion?.title}"?
            </p>
            <div className="form-item">
              <label className="form-label">Reason (optional)</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="Explain why this suggestion is being declined..."
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                className="secondary-button" 
                onClick={() => setShowDeclineModal(false)}
              >
                Cancel
              </button>
              <button 
                className="primary-button" 
                onClick={confirmDecline}
                style={{ background: '#ef4444' }}
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Admin: View Users Screen
function AdminViewUsersScreen({ onGoHome }) {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('joinDate');

  useEffect(() => {
    if (typeof UserAccount !== 'undefined' && UserAccount.isAdmin()) {
      const allUsers = typeof AdminUtils !== 'undefined' ? AdminUtils.getAllUsers() : [];
      setUsers(allUsers);
    }
  }, []);

  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by selected criteria
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'username':
          return a.username.localeCompare(b.username);
        case 'role':
          return (a.role || 'user').localeCompare(b.role || 'user');
        case 'articlesRead':
          return (b.activities?.totalArticlesRead || 0) - (a.activities?.totalArticlesRead || 0);
        case 'streak':
          return (b.activities?.streakDays || 0) - (a.activities?.streakDays || 0);
        case 'joinDate':
        default:
          return new Date(b.joinDate || 0) - new Date(a.joinDate || 0);
      }
    });
  }, [users, searchTerm, sortBy]);

  const handleRoleChange = (userId, newRole) => {
    const updatedUsers = users.map(user => 
      user.id === userId ? { ...user, role: newRole } : user
    );
    setUsers(updatedUsers);
    // In a real app, this would update the backend
    AdminUtils.updateUserRole(userId, newRole);
  };

  const handleDeleteUser = (userId) => {
    if (confirm('Are you sure you want to delete this user?')) {
      const updatedUsers = users.filter(user => user.id !== userId);
      setUsers(updatedUsers);
      // In a real app, this would delete from backend
      AdminUtils.deleteUser(userId);
    }
  };

  return (
    <div className="screen">
      <NavExitButtons currentScreen="admin-users" onGoHome={onGoHome} />
      <h2 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>View Users (Admin)</h2>
      <div className="secondary-text" style={{ marginBottom: '1.5rem' }}>
        User profiles and activity overview
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ 
            padding: '0.5rem', 
            borderRadius: '8px', 
            border: '1px solid rgba(148, 163, 184, 0.4)',
            background: 'rgba(15, 23, 42, 0.9)',
            color: '#f7f9ff',
            flex: 1,
            minWidth: '200px'
          }}
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ 
            padding: '0.5rem', 
            borderRadius: '8px', 
            border: '1px solid rgba(148, 163, 184, 0.4)',
            background: 'rgba(15, 23, 42, 0.9)',
            color: '#f7f9ff'
          }}
        >
          <option value="joinDate">Join Date</option>
          <option value="username">Username</option>
          <option value="role">Role</option>
          <option value="articlesRead">Articles Read</option>
          <option value="streak">Streak</option>
        </select>
      </div>

      <div className="users-list">
        {filteredUsers.length === 0 ? (
          <div className="secondary-text">
            {searchTerm ? 'No users found matching your search.' : 'No users found.'}
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="user-profile-card">
              <div className="user-profile-header">
                <div className="user-profile-name">{user.username}</div>
                <div className="user-profile-actions">
                  <select
                    value={user.role || 'user'}
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                    style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      border: '1px solid rgba(148, 163, 184, 0.4)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#f7f9ff',
                      marginRight: '0.5rem'
                    }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #ef4444',
                      background: '#ef4444',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="user-profile-details">
                <div><strong>Joined:</strong> {new Date(user.joinDate).toLocaleDateString()}</div>
                <div><strong>Articles Read:</strong> {user.activities?.totalArticlesRead || 0}</div>
                <div><strong>Streak:</strong> {user.activities?.streakDays || 0} days</div>
                <div><strong>Last Active:</strong> {user.activities?.lastActiveDate ? new Date(user.activities.lastActiveDate).toLocaleDateString() : 'Never'}</div>
                <div><strong>Capital:</strong> ${user.preferences?.investingCapital?.toLocaleString() || '0'}</div>
                <div><strong>Experience:</strong> {user.preferences?.yearsOfExperience || 'newcomer'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Account Settings Screen (integrated with module)
function AccountScreen({ userAccount, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && typeof AccountSettings !== 'undefined') {
      AccountSettings.init(containerRef.current, userAccount, onClose);
    }
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="screen">
      <div ref={containerRef}></div>
    </div>
  );
}

// Main App Root
function AppRoot() {
  const [tree, setTree] = useState(() => {
    // Try to load existing tree from window first
    if (typeof window !== 'undefined' && window.cryptoHustleTree) {
      console.log('Using existing window.cryptoHustleTree');
      return window.cryptoHustleTree;
    }
    console.log('Initializing with empty tree');
    return { fields: [] };
  });
  const [screen, setScreen] = useState('home');
  const [showNav, setShowNav] = useState(false);
  const [articleNode, setArticleNode] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [guestMode, setGuestMode] = useState(() => isGuestSessionActive());
  const [authUiRetryCount, setAuthUiRetryCount] = useState(0);
  const inAppTimerRef = useRef(null);

  async function _getTreeStateKey() {
    if (!window.CryptoUtils || typeof window.CryptoUtils.generateKeyFromString !== 'function') {
      throw new Error('CryptoUtils not available');
    }
    const uid = window.localStorage.getItem('cryptoExplorer.userId');
    if (!uid) {
      throw new Error('You must be signed in to save tree state');
    }
    return await window.CryptoUtils.generateKeyFromString(uid, 'crypto-explorer-treemap');
  }

  async function saveTreeStateToFirebase() {
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
      throw new Error('Firebase not available');
    }
    const uid = window.localStorage.getItem('cryptoExplorer.userId');
    if (!uid) throw new Error('You must be signed in to save tree state');
    if (!window.TreeScreenState || typeof window.TreeScreenState.getState !== 'function') {
      throw new Error('Tree is not ready to export state');
    }

    const rawState = window.TreeScreenState.getState();
    const json = JSON.stringify({ v: 1, t: Date.now(), state: rawState });
    const compressed = await window.CryptoUtils.compressString(json);
    const key = await _getTreeStateKey();
    const encrypted = await window.CryptoUtils.encryptData(key, compressed);

    await firebase.firestore().collection('users').doc(uid).set({
      treemap_state_v1: {
        enc: encrypted,
        updated_at: new Date(),
      }
    }, { merge: true });

    try {
      if (typeof UserAccount !== 'undefined' && UserAccount?.saveTreeState) {
        UserAccount.saveTreeState(rawState);
      }
    } catch {}

    return true;
  }

  async function loadTreeStateFromFirebase() {
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
      throw new Error('Firebase not available');
    }
    const uid = window.localStorage.getItem('cryptoExplorer.userId');
    if (!uid) throw new Error('You must be signed in to load tree state');

    const snap = await firebase.firestore().collection('users').doc(uid).get();
    if (!snap.exists) throw new Error('No user profile found');

    const data = snap.data() || {};
    const blob = data.treemap_state_v1;
    if (!blob?.enc) throw new Error('No saved Tree state found');

    const key = await _getTreeStateKey();
    const compressed = await window.CryptoUtils.decryptData(key, blob.enc);
    const json = await window.CryptoUtils.decompressString(compressed);
    const parsed = JSON.parse(json);
    return parsed?.state || null;
  }

  async function applyLoadedTreeState(state) {
    if (!state) throw new Error('No tree state to apply');
    if (!window.TreeScreenState || typeof window.TreeScreenState.applyState !== 'function') {
      throw new Error('Tree is not ready to apply state');
    }
    window.TreeScreenState.applyState(state);
    try {
      if (typeof UserAccount !== 'undefined' && UserAccount?.saveTreeState) {
        UserAccount.saveTreeState(state);
      }
    } catch {}
    return true;
  }

  useEffect(() => {
    window.TreeStateSync = {
      save: saveTreeStateToFirebase,
      load: loadTreeStateFromFirebase,
      apply: applyLoadedTreeState,
    };
    return () => {
      if (window.TreeStateSync) window.TreeStateSync = null;
    };
  }, []);

  // Initialize gamification engine once
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Gamification && typeof window.Gamification.init === 'function') {
      try {
        window.Gamification.init();
      } catch (e) {
        console.warn('[Main] Gamification init failed:', e);
      }
    }
  }, []);

  // Firebase auth state listener
  useEffect(() => {
    console.log('[Main] Setting up Firebase auth listener...');

    let unsubscribe = null;
    let cancelled = false;

    const fallbackTimer = setTimeout(() => {
      if (cancelled) return;
      console.warn('[Main] Firebase auth did not resolve in time; continuing to auth UI');
      setAuthResolved(true);
    }, 4000); // Reduced timeout

    const attach = () => {
      if (cancelled) return;
      try {
        if (typeof firebase === 'undefined' || !firebase?.auth) {
          return false;
        }

        // firebase.auth is a function in Firebase v8 CDN
        const auth = typeof firebase.auth === 'function' ? firebase.auth() : null;
        if (!auth?.onAuthStateChanged) {
          return false;
        }

        // Check current user immediately to avoid waiting
        const currentUser = auth.currentUser;
        if (currentUser !== null) {
          console.log('[Main] Firebase user already authenticated:', currentUser.email);
          setAuthenticated(true);
          setAuthResolved(true);
          clearTimeout(fallbackTimer);
        }

        unsubscribe = auth.onAuthStateChanged((user) => {
          if (cancelled) return;
          console.log('[Main] Firebase auth state changed:', user ? 'User logged in' : 'User logged out');
          setAuthenticated(!!user);
          setAuthResolved(true);
          clearTimeout(fallbackTimer);
          
          if (window.AuthPipeline0_5 && user) {
            window.AuthPipeline0_5.currentUser = user;
            window.AuthPipeline0_5._hasResolvedAuthState = true;
            window.AuthPipeline0_5._initializing = false;
          }

          if (user?.uid) {
            try {
              window.localStorage.setItem('cryptoExplorer.userId', user.uid);
            } catch {}

            syncRoleAndProfile(user).then((profile) => {
              console.log('[AppRoot] Role sync completed, profile:', profile);
              
              // Update current user data to trigger re-renders
              if (typeof UserAccount !== 'undefined' && UserAccount.getUserData) {
                const freshUserData = UserAccount.getUserData();
                console.log('[AppRoot] Updating currentUserData:', freshUserData);
                setCurrentUserData(freshUserData);
              }
              
              try {
                if (typeof UserAccount !== 'undefined' && UserAccount?.getRole && UserAccount.getRole() !== 'admin') {
                  const originalLog = console.log;
                  if (!console.__cryptoExplorerFiltered) {
                    console.__cryptoExplorerFiltered = true;
                    console.log = (...args) => {
                      const first = args[0];
                      const msg = typeof first === 'string' ? first : '';
                      if (msg.includes('❌') || msg.includes('⚠️')) return originalLog(...args);
                    };
                  }
                }
              } catch {}
            });
          } else {
            // User logged out - clear user data
            console.log('[AppRoot] User logged out, clearing user data');
            setCurrentUserData({ username: 'Guest', pfp: null, role: 'user', preferences: {} });
          }
        }, (error) => {
          if (cancelled) return;
          console.error('[Main] Firebase auth observer error:', error);
          setAuthenticated(false);
          setAuthResolved(true);
          clearTimeout(fallbackTimer);
        });

        return true;
      } catch (e) {
        console.error('[Main] Failed to attach Firebase auth listener:', e);
        return false;
      }
    };

    // Check for guest mode first
    if (window.AuthPipeline0_5 && window.AuthPipeline0_5.isGuestUser()) {
      console.log('[Main] Guest user detected, setting authenticated state');
      setAuthenticated(true);
      setAuthResolved(true);
      setGuestMode(true);
      clearTimeout(fallbackTimer);
      return () => {};
    }

    if (!attach()) {
      console.log('[Main] Firebase not available for auth listener yet; polling...');
      const intv = setInterval(() => {
        if (attach()) {
          clearInterval(intv);
        }
      }, 200); // Slower polling

      return () => {
        cancelled = true;
        clearInterval(intv);
        clearTimeout(fallbackTimer);
        try {
          if (typeof unsubscribe === 'function') unsubscribe();
        } catch {}
      };
    }

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      try {
        if (typeof unsubscribe === 'function') unsubscribe();
      } catch {}
    };
  }, []);

  // If auth UI is missing after auth is resolved and not guest, attempt to reload scripts.
  useEffect(() => {
    if (!authResolved) return;
    if (authenticated) return;
    if (guestMode) return;

    if (window.SimpleAuthScreen && window.AuthPipeline0_5) return;

    let cancelled = false;

    (async () => {
      try {
        console.error('[Main] Critical: Auth UI failed to load. Retrying...');
        await loadScript('/AuthPipeline0.5.js');
        await loadScript('/SimpleAuthScreen.js');
        if (!cancelled) setAuthUiRetryCount((c) => c + 1);
      } catch (e) {
        console.error('[Main] Auth UI reload failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authResolved, authenticated, guestMode]);

  const bookmarksApi = useBookmarks();
  const userAccount = (() => {
    try {
      if (typeof UserAccount !== 'undefined' && UserAccount) {
        console.log('Using loaded UserAccount');
        return UserAccount;
      }
    } catch (error) {
      console.error('Error accessing UserAccount:', error);
    }
    
    console.log('Using fallback UserAccount');
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

  // Create enhanced userAccount wrapper that provides current user data
  const userAccountWrapper = useMemo(() => {
    return {
      ...userAccount,
      getUserData: () => currentUserData,
      // Force refresh from storage when needed
      refreshUserData: () => {
        if (typeof UserAccount !== 'undefined' && UserAccount.getUserData) {
          const fresh = UserAccount.getUserData();
          setCurrentUserData(fresh);
          return fresh;
        }
        return currentUserData;
      }
    };
  }, [userAccount, currentUserData]);

  // FIXED: Always prioritize CryptoTree.json as the single source of truth
  useEffect(() => {
    console.log('AppRoot: Initializing with centralized tree data from CryptoTree.json');
    
    // Listen for tree updates
    const handleTreeUpdate = (event) => {
      console.log('Tree updated event received:', event.detail);
      setTree({ ...event.detail });
      // FIXED: Force re-render of TreeScreen
      if (screen === 'tree') {
        setScreen('home');
        setTimeout(() => setScreen('tree'), 100);
      }
    };
    
    window.addEventListener('treeUpdated', handleTreeUpdate);
    
    // CENTRALIZED: Load tree data only from CryptoTree.json
    const loadTreeData = async () => {
      try {
        console.log('AppRoot: Fetching tree from centralized CryptoTree.json');
        
        // Try API first (serves CryptoTree.json)
        let data = null;
        try {
          const res = await fetch('/api/tree');
          if (res.ok) {
            data = await res.json();
            console.log('AppRoot: Tree loaded from API (CryptoTree.json):', data);
          }
        } catch (apiError) {
          console.warn('API not available, trying direct JSON file');
        }
        
        // Fallback to direct JSON file
        if (!data) {
          const res = await fetch('/data/cryptoTree.json');
          if (res.ok) {
            data = await res.json();
            console.log('AppRoot: Tree loaded from direct JSON file:', data);
          }
        }
        
        if (data && data.fields && Array.isArray(data.fields)) {
          setTree(data);
          // Update window.cryptoHustleTree to match centralized data
          window.cryptoHustleTree = data;
          console.log('✅ Centralized tree data set in AppRoot');
        } else {
          throw new Error('Invalid tree structure');
        }
      } catch (err) {
        console.error('❌ Failed to load centralized tree data:', err);
        // Use empty tree as fallback
        const emptyTree = { fields: [] };
        setTree(emptyTree);
        window.cryptoHustleTree = emptyTree;
      }
    };
    
    loadTreeData();
    
    // Initialize user account
    userAccount.updateStreak();
    const user = userAccount.getUserData();
    if (user.preferences.defaultScreen) {
      setScreen(user.preferences.defaultScreen);
    }
    
    // Cleanup
    return () => {
      window.removeEventListener('treeUpdated', handleTreeUpdate);
    };
  }, []);

  function openArticle(node) {
    setArticleNode(node);
    setScreen('article');
    userAccount.recordArticleRead(node);
  }

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState(() => {
    // Initialize from UserAccount on first render
    try {
      if (typeof UserAccount !== 'undefined' && UserAccount.getUserData) {
        return UserAccount.getUserData();
      }
    } catch (e) {
      console.error('[AppRoot] Error loading initial user data:', e);
    }
    return { username: 'Guest', pfp: null, role: 'user', preferences: {} };
  });

  // Sync admin status whenever auth state changes
  useEffect(() => {
    if (!authenticated && !guestMode) {
      setIsAdmin(false);
      setIsAdminLoading(false);
      return;
    }

    const checkAdminStatus = async () => {
      setIsAdminLoading(true);
      try {
        if (typeof AdminUtils !== 'undefined' && AdminUtils.isAdmin) {
          const adminStatus = await AdminUtils.isAdmin();
          console.log('[AppRoot] Admin check result:', adminStatus);
          setIsAdmin(adminStatus);
        } else if (typeof UserAccount !== 'undefined' && UserAccount.isAdmin) {
          const adminStatus = await UserAccount.isAdmin();
          console.log('[AppRoot] Admin check via UserAccount:', adminStatus);
          setIsAdmin(adminStatus);
        } else {
          console.warn('[AppRoot] No admin utils available');
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('[AppRoot] Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsAdminLoading(false);
      }
    };

    checkAdminStatus();
  }, [authenticated, guestMode, currentUserData.username]);

  function handleNavSelect(id) {
    if (id === 'tree') setScreen('tree');
    else if (id === 'my-insights') setScreen('my-insights');
    else if (id === 'level-up') setScreen('level-up');
    else if (id === 'favorite') setScreen('favorites');
    else if (id === 'explore') setScreen('explore');
    else if (id === 'new') setScreen('new');
    else if (id === 'contribute') setScreen('contribute');
    else if (id === 'admin-article') setScreen('admin-article');
    else if (id === 'admin-suggestions') setScreen('admin-suggestions');
    else if (id === 'admin-users') setScreen('admin-users');
  }

  function goHome() {
    // Clear any lingering tree elements before switching
    const cleanup = () => {
      const treeElements = document.querySelectorAll('.tree-space, .tree-section-tile');
      treeElements.forEach(el => {
        if (el.style) {
          el.style.background = '';
          el.style.position = '';
        }
      });
    };
    cleanup();
    setScreen('home');
    setShowAccount(false);
  }

  function goToTree() {
    // Clear any lingering tree elements before switching
    const cleanup = () => {
      const treeElements = document.querySelectorAll('.tree-space, .tree-section-tile');
      treeElements.forEach(el => {
        if (el.style) {
          el.style.background = '';
          el.style.position = '';
        }
      });
    };
    cleanup();
    setScreen('tree');
  }

  function handleAccountToggle() {
    // Echo mechanics: clicking again closes account
    setShowAccount(prev => {
      if (prev) {
        setScreen('home'); // Return to home when closing
        return false;
      }
      return true;
    });
  }

  // Track screen visits with UserActivityTracker
  useEffect(() => {
    if (typeof window !== 'undefined' && window.UserActivityTracker) {
      window.UserActivityTracker.trackScreenVisit(screen);
    }

    if (typeof window !== 'undefined' && window.Gamification && typeof window.Gamification.trackScreenVisit === 'function') {
      window.Gamification.trackScreenVisit(screen).catch(() => {});
    }
  }, [screen]);

  // Increment in-app time while app is visible and authenticated
  useEffect(() => {
    function stopTimer() {
      if (inAppTimerRef.current) {
        clearInterval(inAppTimerRef.current);
        inAppTimerRef.current = null;
      }
    }

    function startTimer() {
      if (inAppTimerRef.current) return;
      inAppTimerRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (!authenticated) return;
        if (typeof window !== 'undefined' && window.Gamification && typeof window.Gamification.incrementInAppTime === 'function') {
          window.Gamification.incrementInAppTime(1000).catch(() => {});
        }
      }, 1000);
    }

    if (authenticated) startTimer();
    else stopTimer();

    const visHandler = () => {
      if (document.hidden) stopTimer();
      else if (authenticated) startTimer();
    };

    document.addEventListener('visibilitychange', visHandler);
    return () => {
      document.removeEventListener('visibilitychange', visHandler);
      stopTimer();
    };
  }, [authenticated]);

  // Track article reading
  useEffect(() => {
    if (articleNode && typeof window !== 'undefined' && window.UserActivityTracker) {
      window.UserActivityTracker.trackArticleStart(articleNode);
    }
    
    return () => {
      if (articleNode && typeof window !== 'undefined' && window.UserActivityTracker) {
        window.UserActivityTracker.trackArticleComplete(articleNode);
      }
    };
  }, [articleNode]);

  // Auth gating: wait until Firebase has resolved auth state at least once.
  // Do not allow guest fallback until user explicitly chooses it.
  console.log('[Main] Auth state check:', {
    authenticated,
    authResolved,
    guestMode,
    SimpleAuthScreen: !!window.SimpleAuthScreen,
    AuthPipeline0_5: !!window.AuthPipeline0_5,
    authUiRetryCount,
  });

  if (!authenticated) {
    if (!authResolved) {
      return (
        <div className="app-root" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '16px', padding: '2rem', textAlign: 'center', maxWidth: '420px', width: '100%' }}>
              <h3 style={{ color: '#f7f9ff', marginBottom: '1rem' }}>Initializing Authentication...</h3>
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Waiting for Firebase to restore session from local storage.</p>
            </div>
          </div>
        </div>
      );
    }

    if (guestMode) {
      // Guest mode active: allow access to app without Firebase auth.
      // This keeps the rest of the UI intact.
      // (No early guest fallback before auth resolved.)
    } else {
      // Truly logged out and NOT a guest: force the real auth screen
      if (window.SimpleAuthScreen) {
        return (
          <div className="app-root" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
            {React.createElement(window.SimpleAuthScreen, {
              onAuthSuccess: (user) => {
                console.log('Auth success', user);
                setAuthenticated(true);
                setGuestMode(false);
                setGuestSessionActive(false);
              }
            })}
          </div>
        );
      }

      return (
        <div className="app-root" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '16px', padding: '2rem', textAlign: 'center', maxWidth: '460px', width: '100%' }}>
              <h3 style={{ color: '#f7f9ff', marginBottom: '1rem' }}>Loading Authentication UI...</h3>
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                Critical: Auth UI failed to load. Retrying...
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
                <button
                  onClick={() => {
                    setGuestMode(true);
                    setGuestSessionActive(true);
                  }}
                  style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '8px', color: 'white', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  Continue as Guest
                </button>

                <button
                  onClick={() => window.location.reload()}
                  style={{ padding: '0.75rem 1.5rem', background: 'rgba(148, 163, 184, 0.15)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '8px', color: '#f7f9ff', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  Reload
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '1rem' }}>
                Debug: SimpleAuthScreen={String(!!window.SimpleAuthScreen)}, AuthPipeline0_5={String(!!window.AuthPipeline0_5)}, retries={authUiRetryCount}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Show loading screen if tree is not ready
  if (!tree || !tree.fields || tree.fields.length === 0) {
    // Try to load from window.cryptoHustleTree if available
    if (window.cryptoHustleTree && window.cryptoHustleTree.fields && window.cryptoHustleTree.fields.length > 0) {
      console.log('Loading tree from window.cryptoHustleTree');
      setTree(window.cryptoHustleTree);
      return null; // Re-render with new tree data
    }
    
    return (
      <div className="app-root">
        <div className="screen" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Loading OntyFi...</h2>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚀</div>
            <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
              Initializing the crypto knowledge tree...
            </p>
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              Tree data: {tree ? `${tree.fields?.length || 0} fields` : 'loading...'}
            </p>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <div style={{ 
              width: '200px', 
              height: '4px', 
              background: 'rgba(148, 163, 184, 0.3)', 
              borderRadius: '2px',
              margin: '0 auto',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: '100%', 
                height: '100%', 
                background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
                animation: 'loading 2s ease-in-out infinite'
              }} />
            </div>
          </div>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              className="primary-button" 
              onClick={() => {
                console.log('Debug info:', {
                  tree,
                  windowTree: window.cryptoHustleTree,
                  TreeScreen: typeof window.TreeScreen,
                  LevelUpScreen: typeof window.LevelUpScreen
                });
                if (window.TreeScreenDebugger) {
                  window.TreeScreenDebugger.displayReport();
                }
              }}
            >
              Debug Info
            </button>
            <button 
              className="primary-button" 
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button 
              className="secondary-button" 
              onClick={() => {
                // Try to initialize with empty tree
                setTree({ fields: [] });
              }}
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      {screen === 'home' && !showAccount && (
        <HomeScreen
          userAccount={userAccountWrapper}
          bookmarksApi={bookmarksApi}
          onOpenAccount={handleAccountToggle}
          onNavigateToTree={() => setScreen('tree')}
          onOpenArticle={openArticle}
          onNavigateToMyInsights={() => setScreen('my-insights')}
          tree={tree}
        />
      )}
      {screen === 'home' && showAccount && (
        <AccountScreen userAccount={userAccountWrapper} onClose={handleAccountToggle} />
      )}
      {screen === 'my-insights' && !showAccount && (
        React.createElement(getMyInsightsScreen(), { onGoHome: goHome })
      )}
      {screen === 'tree' && !showAccount && (
        <TreeScreen
          tree={tree}
          onOpenArticle={openArticle}
          bookmarksApi={bookmarksApi}
          onGoHome={goHome}
        />
      )}
      {screen === 'level-up' && !showAccount && (
        React.createElement(getLevelUpScreen(), { onGoHome: goHome, onGoToTree: goToTree })
      )}
      {screen === 'article' && !showAccount && (
        <ArticleScreen
          node={articleNode}
          onBackToTree={goToTree}
          bookmarksApi={bookmarksApi}
          userAccount={userAccountWrapper}
          onGoHome={goHome}
          onOpenArticle={openArticle}
        />
      )}
      {screen === 'favorites' && !showAccount && (
        <FavoritesScreen
          bookmarks={bookmarksApi.bookmarks}
          onOpenArticle={openArticle}
          onGoHome={goHome}
          onGoToTree={goToTree}
        />
      )}
      {screen === 'explore' && !showAccount && (
        <ExploreScreen
          tree={tree}
          onOpenArticle={openArticle}
          onGoHome={goHome}
          onGoToTree={goToTree}
        />
      )}
      {screen === 'new' && !showAccount && (
        <NewScreen
          tree={tree}
          onOpenArticle={openArticle}
          onGoHome={goHome}
          onGoToTree={goToTree}
        />
      )}
      {screen === 'contribute' && !showAccount && (
        <ContributeScreen
          tree={tree}
          onGoHome={goHome}
          onGoToTree={goToTree}
        />
      )}
      {screen === 'admin-article' && !showAccount && isAdmin && !isAdminLoading && (
        <AdminNewArticleScreen
          tree={tree}
          onGoHome={goHome}
          onSave={async () => {
            // FIXED: Reload tree and force app refresh
            try {
              const res = await fetch('/api/tree');
              if (res.ok) {
                const data = await res.json();
                setTree(data);
                window.cryptoHustleTree = data;
                window.dispatchEvent(new CustomEvent('treeUpdated', { detail: data }));
              }
            } catch (err) {
              console.warn('Failed to reload tree after save:', err);
            }
            // Force screen refresh
            setScreen('home');
            setTimeout(() => setScreen('tree'), 200);
          }}
        />
      )}
      {screen === 'admin-suggestions' && !showAccount && isAdmin && !isAdminLoading && (
        <AdminSuggestionsReview
          tree={tree}
          onGoHome={goHome}
          onPublish={async () => {
            // Reload tree after publishing
            try {
              const res = await fetch('/api/tree');
              if (res.ok) {
                const data = await res.json();
                setTree(data);
                window.cryptoHustleTree = data;
                window.dispatchEvent(new CustomEvent('treeUpdated', { detail: data }));
              }
            } catch (err) {
              console.warn('Failed to reload tree after publish:', err);
            }
          }}
        />
      )}
      {screen === 'admin-users' && !showAccount && isAdmin && !isAdminLoading && (
        <AdminViewUsersScreen onGoHome={goHome} />
      )}

      {!showAccount && <MenuWheel onToggle={() => setShowNav(true)} />}
      {showNav && (
        <NavOverlay
          onClose={() => setShowNav(false)}
          onNavigate={handleNavSelect}
          currentScreen={screen}
          isOpen={showNav}
        />
      )}
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.group('🚨 APP ERROR BOUNDARY');
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo?.componentStack);
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-root" style={{ minHeight: '100vh' }}>
          <div className="screen" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>App Error</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
              A screen crashed during navigation. This is now contained so the app won’t fully reload.
            </p>
            <div style={{
              textAlign: 'left',
              maxWidth: '900px',
              margin: '0 auto 1.5rem auto',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              background: 'rgba(15, 23, 42, 0.8)',
              color: '#e2e8f0',
              overflow: 'auto'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Error message</div>
              <div style={{ color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
                {(this.state.error && (this.state.error.stack || this.state.error.message)) || 'Unknown error'}
              </div>
            </div>
            <button className="primary-button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

try {
  window.addEventListener('error', (e) => {
    console.error('🌋 window.onerror:', e?.message || e, e?.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('🌋 unhandledrejection:', e?.reason || e);
  });
} catch {}

// Backward compatible alias: older bootstraps expected a global `App`.
// We render the actual root component defined in this file.
function App() {
  return <AppRoot />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

} // End startApp
