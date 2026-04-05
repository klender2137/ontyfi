// User Account Module - Manages user data, activities, preferences

const UserAccount = (function() {
  const STORAGE_KEY = 'cryptoExplorer.userAccount';
  
  // Default user data
  const defaultUser = {
    username: 'crypto.explorer',
    pfp: null, // base64 or URL
    role: 'user',
    preferences: {
      defaultScreen: 'home',
      language: 'en',
      preferredDomain: '',
      investingCapital: 1000,
      yearsOfExperience: 'newcomer',
      highlightKeywords: [] // Array of keywords for tree highlighting
    },
    activities: {
      lastActiveDate: new Date().toISOString(),
      streakDays: 0,
      totalArticlesRead: 0,
      lastArticleRead: null,
      todaysFocus: null
    },
    personalInfo: {
      joinDate: new Date().toISOString()
    }
  };

  // Load user data from localStorage
  function loadUser() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate parsed data structure
        if (parsed && typeof parsed === 'object' && parsed.username) {
          return { ...defaultUser, ...parsed };
        }
      }
    } catch (e) {
      console.error('Error loading user account:', e);
      // Clear corrupted data
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    return { ...defaultUser };
  }

  // Save user data to localStorage
  function saveUser(userData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return true;
    } catch (e) {
      console.error('Error saving user account:', e);
      return false;
    }
  }

  // Update streak based on activity
  function updateStreak() {
    const user = loadUser();
    const today = new Date().toISOString().split('T')[0];
    const lastActive = user.activities.lastActiveDate 
      ? new Date(user.activities.lastActiveDate).toISOString().split('T')[0]
      : null;

    if (lastActive === today) {
      // Already active today
      return user.activities.streakDays;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastActive === yesterdayStr) {
      // Continue streak
      user.activities.streakDays += 1;
    } else if (lastActive !== today) {
      // Reset streak
      user.activities.streakDays = 1;
    }

    user.activities.lastActiveDate = new Date().toISOString();
    saveUser(user);
    return user.activities.streakDays;
  }

  // Record article read
  function recordArticleRead(articleNode) {
    const user = loadUser();
    user.activities.totalArticlesRead += 1;
    user.activities.lastArticleRead = {
      id: articleNode.id,
      name: articleNode.name,
      date: new Date().toISOString()
    };
    saveUser(user);
    updateStreak();
  }

  // Set today's focus
  function setTodaysFocus(node) {
    const user = loadUser();
    const today = new Date().toISOString().split('T')[0];
    const currentFocusDate = user.activities.todaysFocus?.date 
      ? new Date(user.activities.todaysFocus.date).toISOString().split('T')[0]
      : null;

    if (currentFocusDate !== today) {
      user.activities.todaysFocus = {
        id: node.id,
        name: node.name,
        path: node.path,
        date: new Date().toISOString()
      };
      saveUser(user);
    }
  }

  // Get today's focus
  function getTodaysFocus() {
    const user = loadUser();
    const today = new Date().toISOString().split('T')[0];
    const focusDate = user.activities.todaysFocus?.date
      ? new Date(user.activities.todaysFocus.date).toISOString().split('T')[0]
      : null;

    if (focusDate === today) {
      return user.activities.todaysFocus;
    }
    return null;
  }

  // Update preferences
  function updatePreferences(newPrefs) {
    const user = loadUser();
    user.preferences = { ...user.preferences, ...newPrefs };
    saveUser(user);
    return user.preferences;
  }

  // Update personal info
  function updatePersonalInfo(newInfo) {
    const user = loadUser();
    user.personalInfo = { ...user.personalInfo, ...newInfo };
    saveUser(user);
    return user.personalInfo;
  }

  // Update username
  function updateUsername(newUsername) {
    const user = loadUser();
    user.username = newUsername;
    saveUser(user);
    return user.username;
  }

  // Update profile picture
  function updatePFP(pfpData) {
    const user = loadUser();
    user.pfp = pfpData;
    saveUser(user);
    return user.pfp;
  }

  // Update user role (admin only)
  function updateUserRole(newRole) {
    const user = loadUser();
    user.role = newRole; // 'user' | 'member' | 'admin'
    saveUser(user);
    return user.role;
  }

  // Check if user is admin - now async and server-verified
  async function isAdmin() {
    // Use AdminUtils server-side verification if available
    if (typeof AdminUtils !== 'undefined' && AdminUtils.isAdmin) {
      return await AdminUtils.isAdmin();
    }
    
    // Fallback: check local role but this is not secure
    // In production, always use AdminUtils
    const user = loadUser();
    return user.role === 'admin';
  }

  // Synchronous check for initial render (not secure, use for UI only)
  function isAdminSync() {
    if (typeof AdminUtils !== 'undefined' && AdminUtils.isAdminSync) {
      return AdminUtils.isAdminSync();
    }
    const user = loadUser();
    return user.role === 'admin';
  }

  function getRole() {
    const user = loadUser();
    return user.role || 'user';
  }

  function mergeFromFirebaseProfile(profile) {
    if (!profile || typeof profile !== 'object') {
      return loadUser();
    }

    const user = loadUser();

    if (profile.username && typeof profile.username === 'string') {
      user.username = profile.username;
    }

    if (profile.display_name && typeof profile.display_name === 'string' && !user.username) {
      user.username = profile.display_name;
    }

    if (profile.role && typeof profile.role === 'string') {
      user.role = profile.role;
    }

    if (profile.activities && typeof profile.activities === 'object') {
      user.activities = { ...user.activities, ...profile.activities };
    }

    if (profile.preferences && typeof profile.preferences === 'object') {
      user.preferences = { ...user.preferences, ...profile.preferences };
    }

    saveUser(user);
    return user;
  }

  // Get all user data
  function getUserData() {
    return loadUser();
  }

  // Update keyword preferences
  function updateKeywords(keywords) {
    const user = loadUser();
    user.preferences.highlightKeywords = Array.isArray(keywords) 
      ? keywords 
      : keywords.split(',').map(k => k.trim()).filter(k => k);
    saveUser(user);
    return user.preferences.highlightKeywords;
  }

  // Save tree state (expanded nodes, positions)
  function saveTreeState(treeState) {
    const user = loadUser();
    user.treeState = treeState;
    saveUser(user);
    return true;
  }

  // Load tree state
  function loadTreeState() {
    const user = loadUser();
    return user.treeState || { expandedIds: [], nodePositions: {} };
  }

  // Get user activities summary
  function getActivitiesSummary() {
    const user = loadUser();
    return {
      streakDays: user.activities.streakDays,
      totalArticlesRead: user.activities.totalArticlesRead,
      lastArticleRead: user.activities.lastArticleRead,
      todaysFocus: getTodaysFocus()
    };
  }

  return {
    loadUser,
    saveUser,
    updateStreak,
    recordArticleRead,
    setTodaysFocus,
    getTodaysFocus,
    updatePreferences,
    updatePersonalInfo,
    updateUsername,
    updatePFP,
    updateUserRole,
    isAdmin,
    isAdminSync,
    getRole,
    getUserData,
    getActivitiesSummary,
    mergeFromFirebaseProfile,
    updateKeywords,
    saveTreeState,
    loadTreeState
  };
})();

// Register to window with error handling
try {
  if (typeof window !== 'undefined') {
    window.UserAccount = UserAccount;
    console.log('UserAccount registered successfully');
  }
} catch (error) {
  console.error('Failed to register UserAccount:', error);
}
