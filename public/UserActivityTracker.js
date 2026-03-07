// UserActivityTracker.js - Comprehensive Firebase Analytics with Encryption
// Tracks all user activities: tiles opened, articles read, time spent, screen visits

class UserActivityTracker {
  constructor() {
    console.log('[UserActivityTracker] Initializing comprehensive activity tracker...');
    
    this.userId = null;
    this.isGhostUser = false;
    this.sessionId = this.generateSessionId();
    this.currentScreen = null;
    this.screenStartTime = null;
    this.articleStartTime = null;
    this.currentArticle = null;
    this.encryptionKey = null;
    
    // Check Firebase availability
    if (typeof window !== 'undefined' && window.firebase) {
      this.firebase = window.firebase;
      console.log('[UserActivityTracker] ✅ Firebase available');
    } else {
      console.error('[UserActivityTracker] ❌ Firebase not available');
      this.firebase = null;
    }
    
    // Initialize user identification
    // Firebase scripts can load before firebase.initializeApp() runs, so we must wait.
    this.initializeUser();
    
    console.log('[UserActivityTracker] ✅ Activity tracker initialized');
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate ghost user ID if not logged in
   */
  generateGhostUserId() {
    let ghostId = localStorage.getItem('ghostUserId');
    if (!ghostId) {
      ghostId = 'ghost_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
      localStorage.setItem('ghostUserId', ghostId);
      console.log('[UserActivityTracker] Generated new ghost user ID:', ghostId);
    }
    return ghostId;
  }

  /**
   * Initialize user identification (logged in or ghost)
   */
  async initializeUser() {
    try {
      await this.waitForFirebaseInit();

      if (this.firebase && this.firebase.auth) {
        const user = this.firebase.auth().currentUser;
        if (user) {
          this.userId = user.uid;
          this.isGhostUser = false;
          console.log('[UserActivityTracker] ✅ Logged in user:', this.userId);
        } else {
          this.userId = this.generateGhostUserId();
          this.isGhostUser = true;
          console.log('[UserActivityTracker] 👻 Ghost user:', this.userId);
        }
      } else {
        this.userId = this.generateGhostUserId();
        this.isGhostUser = true;
        console.log('[UserActivityTracker] 👻 Ghost user (no Firebase):', this.userId);
      }
      
      // Generate encryption key for this user
      this.encryptionKey = await this.generateEncryptionKey();
      
    } catch (error) {
      console.error('[UserActivityTracker] Failed to initialize user:', error);
      this.userId = this.generateGhostUserId();
      this.isGhostUser = true;
    }
  }

  /**
   * Wait until firebase.initializeApp() has created a default app.
   * (Firebase CDN v8 throws "app/no-app" if auth() is called too early.)
   */
  async waitForFirebaseInit() {
    try {
      if (!this.firebase) return;

      const isReady = () => {
        try {
          return Array.isArray(this.firebase.apps) && this.firebase.apps.length > 0;
        } catch (e) {
          return false;
        }
      };

      if (isReady()) return;

      await new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // ~5s
        const t = setInterval(() => {
          attempts += 1;
          if (isReady() || attempts >= maxAttempts) {
            clearInterval(t);
            resolve();
          }
        }, 100);
      });
    } catch (e) {
      // If anything goes wrong here, fall back to ghost user.
    }
  }

  /**
   * Generate encryption key for user data
   */
  async generateEncryptionKey() {
    try {
      // Use user ID as seed for encryption key
      const encoder = new TextEncoder();
      const data = encoder.encode(this.userId + 'crypto-explorer-activity-key');
      const hash = await crypto.subtle.digest('SHA-256', data);
      return new Uint8Array(hash.slice(0, 32)); // Use first 32 bytes as key
    } catch (error) {
      console.error('[UserActivityTracker] Failed to generate encryption key:', error);
      // Fallback to simple key
      return new TextEncoder().encode('fallback-encryption-key-32-bytes-long').slice(0, 32);
    }
  }

  /**
   * Encrypt data using AES-GCM
   */
  async encryptData(data) {
    try {
      if (!this.encryptionKey) return data;
      
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const algorithm = { name: 'AES-GCM', iv };
      
      const key = await crypto.subtle.importKey(
        'raw',
        this.encryptionKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      const encrypted = await crypto.subtle.encrypt(
        algorithm,
        key,
        encoder.encode(JSON.stringify(data))
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('[UserActivityTracker] Encryption failed:', error);
      return JSON.stringify(data); // Fallback to unencrypted
    }
  }

  /**
   * Track screen visit
   */
  trackScreenVisit(screenName) {
    if (!this.firebase) return;
    
    // End previous screen tracking
    if (this.currentScreen && this.screenStartTime) {
      const duration = Date.now() - this.screenStartTime;
      this.logActivity('screen_leave', {
        screen: this.currentScreen,
        duration: duration
      });
    }
    
    // Start new screen tracking
    this.currentScreen = screenName;
    this.screenStartTime = Date.now();
    
    this.logActivity('screen_visit', {
      screen: screenName,
      sessionId: this.sessionId
    });
    
    console.log('[UserActivityTracker] Screen visit tracked:', screenName);
  }

  /**
   * Track tile/article open
   */
  trackTileOpen(tileData) {
    if (!this.firebase) return;
    
    const activityData = {
      tileId: tileData.id,
      tileName: tileData.name,
      tileType: tileData.kind || 'unknown',
      tilePath: tileData.path || [],
      tags: tileData.tags || [],
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    
    this.logActivity('tile_open', activityData);
    console.log('[UserActivityTracker] Tile open tracked:', tileData.name);
  }

  /**
   * Track article read start
   */
  trackArticleStart(articleData) {
    if (!this.firebase) return;
    
    this.currentArticle = articleData.id;
    this.articleStartTime = Date.now();
    
    const activityData = {
      articleId: articleData.id,
      articleName: articleData.name,
      articlePath: articleData.path || [],
      tags: articleData.tags || [],
      startTime: Date.now(),
      sessionId: this.sessionId
    };
    
    this.logActivity('article_start', activityData);
    console.log('[UserActivityTracker] Article start tracked:', articleData.name);
  }

  /**
   * Track article read completion
   */
  trackArticleComplete(articleData) {
    if (!this.firebase) return;
    
    let duration = 0;
    if (this.currentArticle === articleData.id && this.articleStartTime) {
      duration = Date.now() - this.articleStartTime;
    }
    
    const activityData = {
      articleId: articleData.id,
      articleName: articleData.name,
      duration: duration,
      completionTime: Date.now(),
      sessionId: this.sessionId
    };
    
    this.logActivity('article_complete', activityData);
    console.log('[UserActivityTracker] Article complete tracked:', articleData.name, `(${duration}ms)`);
    
    this.currentArticle = null;
    this.articleStartTime = null;
  }

  /**
   * Track search query
   */
  trackSearch(query, mode, resultsCount) {
    if (!this.firebase) return;
    
    const activityData = {
      query: query.trim(),
      mode: mode,
      resultsCount: resultsCount,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    
    this.logActivity('search', activityData);
    console.log('[UserActivityTracker] Search tracked:', query, `(${resultsCount} results)`);
  }

  /**
   * Track bookmark activity
   */
  trackBookmark(action, nodeData) {
    if (!this.firebase) return;
    
    const activityData = {
      action: action, // 'add' or 'remove'
      nodeId: nodeData.id,
      nodeName: nodeData.name,
      nodePath: nodeData.path || [],
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    
    this.logActivity('bookmark', activityData);
    console.log('[UserActivityTracker] Bookmark tracked:', action, nodeData.name);
  }

  /**
   * Log activity to Firebase (encrypted)
   */
  async logActivity(activityType, data) {
    if (!this.firebase) return;
    
    try {
      const encryptedData = await this.encryptData({
        type: activityType,
        data: data,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        isGhostUser: this.isGhostUser
      });
      
      const activityDoc = {
        userId: this.userId,
        activityType: activityType,
        encryptedData: encryptedData,
        timestamp: this.firebase.firestore.FieldValue.serverTimestamp(),
        sessionId: this.sessionId,
        isGhostUser: this.isGhostUser
      };
      
      // Store in user-specific activity collection
      await this.firebase.firestore()
        .collection('user_activities')
        .doc(this.userId)
        .collection('activities')
        .add(activityDoc);
      
      // Also store in global trends for analytics
      await this.firebase.firestore()
        .collection('global_trends')
        .add({
          userId: this.userId,
          activityType: activityType,
          encryptedData: encryptedData,
          timestamp: this.firebase.firestore.FieldValue.serverTimestamp(),
          sessionId: this.sessionId,
          isGhostUser: this.isGhostUser
        });
      
      console.log('[UserActivityTracker] ✅ Activity logged:', activityType);
      
    } catch (error) {
      console.error('[UserActivityTracker] Failed to log activity:', error);
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary() {
    if (!this.firebase) return null;
    
    try {
      const snapshot = await this.firebase.firestore()
        .collection('user_activities')
        .doc(this.userId)
        .collection('activities')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
      
      const activities = [];
      snapshot.forEach(doc => {
        activities.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return activities;
    } catch (error) {
      console.error('[UserActivityTracker] Failed to get activity summary:', error);
      return null;
    }
  }

  /**
   * Cleanup on page unload
   */
  cleanup() {
    if (this.currentScreen && this.screenStartTime) {
      const duration = Date.now() - this.screenStartTime;
      this.logActivity('screen_leave', {
        screen: this.currentScreen,
        duration: duration,
        sessionEnd: true
      });
    }
    
    if (this.currentArticle && this.articleStartTime) {
      const duration = Date.now() - this.articleStartTime;
      this.logActivity('article_interrupted', {
        articleId: this.currentArticle,
        duration: duration
      });
    }
    
    console.log('[UserActivityTracker] Cleanup completed');
  }
}

// Create singleton instance
let userActivityTracker;
try {
  console.log('[UserActivityTracker] Creating tracker instance...');
  userActivityTracker = new UserActivityTracker();
  console.log('[UserActivityTracker] ✅ Tracker instance created successfully');
} catch (error) {
  console.error('[UserActivityTracker] ❌ Failed to create tracker instance:', error);
  userActivityTracker = {
    trackScreenVisit: () => {},
    trackTileOpen: () => {},
    trackArticleStart: () => {},
    trackArticleComplete: () => {},
    trackSearch: () => {},
    trackBookmark: () => {},
    cleanup: () => {}
  };
}

// Export for global use
if (typeof window !== 'undefined') {
  window.UserActivityTracker = userActivityTracker;
  console.log('[UserActivityTracker] ✅ Tracker attached to window object');
  
  // Setup cleanup on page unload
  window.addEventListener('beforeunload', () => {
    userActivityTracker.cleanup();
  });
  
  // Setup visibility change tracking
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      userActivityTracker.cleanup();
    }
  });
} else {
  console.error('[UserActivityTracker] ❌ Window object not available');
}
