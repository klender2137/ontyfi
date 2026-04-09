/**
 * Quest Execution Scripts System
 * Individual quest tracking and execution modules
 * Each quest has its own script with activation and completion logic
 */

const QuestScripts = {
  // Track running quest instances
  activeQuests: new Map(),
  
  // Initialize quest system
  init(firebase, userId) {
    this.fb = firebase;
    this.uid = userId;
    console.log('[QuestScripts] Initialized for user:', userId);
  },

  // Start tracking a quest (activation)
  async activate(questId) {
    if (!this.uid) return;
    
    const quest = QUEST_REGISTRY[questId];
    if (!quest) {
      console.warn('[QuestScripts] Unknown quest:', questId);
      return;
    }
    
    // Check if already completed in Firebase
    const alreadyCompleted = await this._isQuestCompleted(questId);
    if (alreadyCompleted) {
      console.log('[QuestScripts] Quest already completed:', questId);
      return;
    }
    
    // Create quest instance
    const instance = {
      id: questId,
      script: quest,
      status: 'active',
      progress: 0,
      startedAt: Date.now()
    };
    
    this.activeQuests.set(questId, instance);
    
    // Update Firebase status
    await this._updateQuestStatus(questId, {
      status: 'in_progress',
      started_at: this.fb?.firestore?.FieldValue?.serverTimestamp() || new Date()
    });
    
    // Start tracking
    if (quest.onActivate) {
      quest.onActivate(this);
    }
    
    console.log('[QuestScripts] Quest activated:', questId);
  },

  // Report progress for a quest
  async reportProgress(questId, progress, metadata = {}) {
    if (!this.uid) return;
    
    const instance = this.activeQuests.get(questId);
    if (!instance) return;
    
    instance.progress = progress;
    
    const quest = instance.script;
    const target = quest.target || 1;
    
    // Update progress in Firebase
    await this._updateQuestStatus(questId, {
      progress: progress,
      ...metadata
    });
    
    // Check for completion
    if (progress >= target) {
      await this._markClaimable(questId);
    }
  },

  // Mark quest as claimable (ready for reward)
  async _markClaimable(questId) {
    const instance = this.activeQuests.get(questId);
    if (!instance) return;
    
    instance.status = 'claimable';
    
    await this._updateQuestStatus(questId, {
      status: 'claimable',
      claimable_at: this.fb?.firestore?.FieldValue?.serverTimestamp() || new Date()
    });
    
    // Notify
    window.dispatchEvent(new CustomEvent('QuestClaimable', {
      detail: { questId, reward: instance.script.reward }
    }));
    
    console.log('[QuestScripts] Quest claimable:', questId);
  },

  // Check if quest is already completed
  async _isQuestCompleted(questId) {
    if (!this.fb || !this.uid) return false;
    
    try {
      const ref = this.fb.firestore()
        .collection('user_quests')
        .doc(this.uid)
        .collection('quests')
        .doc(questId);
      
      const snap = await ref.get();
      if (!snap.exists) return false;
      
      const data = snap.data();
      return data.status === 'completed' || data.status === 'claimable';
    } catch (e) {
      console.warn('[QuestScripts] Error checking completion:', e);
      return false;
    }
  },

  // Update quest status in Firebase
  async _updateQuestStatus(questId, updates) {
    if (!this.fb || !this.uid) return;
    
    try {
      const ref = this.fb.firestore()
        .collection('user_quests')
        .doc(this.uid)
        .collection('quests')
        .doc(questId);
      
      await ref.set(updates, { merge: true });
    } catch (e) {
      console.warn('[QuestScripts] Error updating status:', e);
    }
  },

  // Stop tracking a quest
  deactivate(questId) {
    const instance = this.activeQuests.get(questId);
    if (instance && instance.script.onDeactivate) {
      instance.script.onDeactivate(this);
    }
    this.activeQuests.delete(questId);
  },

  // Get active quest instance
  getInstance(questId) {
    return this.activeQuests.get(questId);
  }
};

// ============================================================================
// INDIVIDUAL QUEST DEFINITIONS
// ============================================================================

const QUEST_REGISTRY = {
  
  // ---------------------------------------------------------------------------
  // QUEST: LinkedIn Connect
  // Description: Connect a LinkedIn account to your profile
  // Tracking: Monitors linkedin_sub field in user profile
  // ---------------------------------------------------------------------------
  linkedin_connect: {
    id: 'linkedin_connect',
    title: 'Connect LinkedIn',
    description: 'Connect your LinkedIn account for professional profile',
    reward: 50,
    onActivate: async (userId, firebase) => {
      // Listen for linkedin_sub field in user doc
      const userRef = firebase.firestore().collection('users').doc(userId);
      return userRef.onSnapshot((snap) => {
        const data = snap.data() || {};
        if (data.linkedin_sub) {
          // LinkedIn is connected, complete the quest
          const questRef = firebase.firestore().collection('user_quests').doc(userId).collection('quests').doc('linkedin_connect');
          questRef.get().then((qSnap) => {
            if (qSnap.exists) {
              const qData = qSnap.data();
              if (qData.status === 'in_progress') {
                questRef.update({ status: 'claimable', claimable_at: firebase.firestore.FieldValue.serverTimestamp() });
              }
            }
          });
        }
      });
    },
    onDeactivate: (unsubscribe) => {
      if (unsubscribe) unsubscribe();
    }
  },

  // ---------------------------------------------------------------------------
  // QUEST: Visit All Screens
  // Description: Open the Tree, Explore, and Level Up screens
  // Tracking: Monitors screens_visited array in user stats
  // ---------------------------------------------------------------------------
  visit_all_screens: {
    id: 'visit_all_screens',
    title: 'Visit All Screens',
    description: 'Visit all screens from the Menu (activate to start tracking)',
    reward: 100,
    target: 7,
    
    requiredScreens: ['home', 'tree', 'explore', 'career', 'my-hustle', 'insights', 'level-up'],
    
    onActivate(qs) {
      // Set up listener for screen visits
      this.unsubscribe = qs.fb.firestore()
        .collection('users')
        .doc(qs.uid)
        .onSnapshot((snap) => {
          if (!snap.exists) return;
          
          const data = snap.data();
          const visited = data.stats?.screens_visited || [];
          
          // Count required screens visited
          const visitedRequired = this.requiredScreens.filter(
            screen => visited.includes(screen)
          );
          
          const progress = visitedRequired.length;
          
          qs.reportProgress(this.id, progress, {
            screens_visited: visitedRequired,
            all_visited: progress >= this.target
          });
        });
    },
    
    onDeactivate(qs) {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    }
  },

  // ---------------------------------------------------------------------------
  // QUEST: Bubble Bounce
  // Description: Pop tag bubbles 25 times
  // Tracking: Monitors bubble_bounces counter in user stats
  // ---------------------------------------------------------------------------
  bubble_bounce: {
    id: 'bubble_bounce',
    title: 'Bubble Bounce',
    description: 'Pop tag bubbles 25 times',
    reward: 150,
    target: 25,
    
    onActivate(qs) {
      // Set up listener for bubble bounces
      this.unsubscribe = qs.fb.firestore()
        .collection('users')
        .doc(qs.uid)
        .onSnapshot((snap) => {
          if (!snap.exists) return;
          
          const data = snap.data();
          const bounces = data.stats?.bubble_bounces || 0;
          
          qs.reportProgress(this.id, Math.min(bounces, this.target), {
            bubble_bounces: bounces
          });
        });
    },
    
    // Manual increment method (called from UI)
    increment(qs) {
      if (!qs.fb || !qs.uid) return;
      
      const userRef = qs.fb.firestore().collection('users').doc(qs.uid);
      userRef.set({
        'stats.bubble_bounces': qs.fb.firestore.FieldValue.increment(1)
      }, { merge: true });
    },
    
    onDeactivate(qs) {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    }
  },

  // ---------------------------------------------------------------------------
  // QUEST: Curious Explorer
  // Description: Open all 9 core tiles in the TreeMap
  // Tracking: Monitors opened_core_tiles array in user stats
  // ---------------------------------------------------------------------------
  curious: {
    id: 'curious',
    title: 'Curious Explorer',
    description: 'Open all 9 core tiles in the TreeMap (activate first to track)',
    reward: 50,
    target: 9,
    
    onActivate: async (userId, firebase) => {
      // Only track progress after quest is activated (status becomes 'in_progress')
      const questRef = firebase.firestore().collection('user_quests').doc(userId).collection('quests').doc('curious');
      const userRef = firebase.firestore().collection('users').doc(userId);
      
      // Set up listener that only tracks changes after activation
      return questRef.onSnapshot(async (qSnap) => {
        if (!qSnap.exists) return;
        const qData = qSnap.data();
        
        // Only track if quest is in_progress (user clicked Activate)
        if (qData.status !== 'in_progress' && qData.status !== 'claimable') return;
        
        // Get current opened tiles
        const userSnap = await userRef.get();
        const data = userSnap.data() || {};
        const openedTiles = data.stats?.opened_core_tiles || [];
        const uniqueCount = new Set(openedTiles).size;
        
        if (qData.status === 'in_progress') {
          if (uniqueCount >= 9) {
            await questRef.update({ 
              status: 'claimable', 
              progress: 9, 
              target: 9,
              claimable_at: firebase.firestore.FieldValue.serverTimestamp() 
            });
          } else {
            await questRef.update({ progress: uniqueCount, target: 9 });
          }
        }
      });
    },
    
    onDeactivate: (unsubscribe) => {
      if (unsubscribe) unsubscribe();
    }
  },

  // ---------------------------------------------------------------------------
  // QUEST: Daily Reader
  // Description: Read at least 3 articles in a day
  // Tracking: Monitors daily article reads
  // ---------------------------------------------------------------------------
  daily_reader: {
    id: 'daily_reader',
    title: 'Daily Reader',
    description: 'Read 3 articles today',
    reward: 75,
    target: 3,
    
    onActivate(qs) {
      const today = new Date().toISOString().split('T')[0];
      
      this.unsubscribe = qs.fb.firestore()
        .collection('users')
        .doc(qs.uid)
        .onSnapshot((snap) => {
          if (!snap.exists) return;
          
          const data = snap.data();
          const dailyReads = data.activities?.daily_reads || {};
          const todayCount = dailyReads[today] || 0;
          
          qs.reportProgress(this.id, todayCount, {
            date: today,
            articles_read: todayCount
          });
        });
    },
    
    trackArticleRead(qs) {
      if (!qs.fb || !qs.uid) return;
      
      const today = new Date().toISOString().split('T')[0];
      const userRef = qs.fb.firestore().collection('users').doc(qs.uid);
      
      userRef.set({
        [`activities.daily_reads.${today}`]: qs.fb.firestore.FieldValue.increment(1)
      }, { merge: true });
    },
    
    onDeactivate(qs) {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    }
  },

  // ---------------------------------------------------------------------------
  // QUEST: Streak Keeper
  // Description: Maintain a 7-day streak
  // Tracking: Monitors streak_days counter
  // ---------------------------------------------------------------------------
  streak_keeper: {
    id: 'streak_keeper',
    title: 'Streak Keeper',
    description: 'Maintain a 7-day activity streak',
    reward: 200,
    target: 7,
    
    onActivate(qs) {
      this.unsubscribe = qs.fb.firestore()
        .collection('users')
        .doc(qs.uid)
        .onSnapshot((snap) => {
          if (!snap.exists) return;
          
          const data = snap.data();
          const streak = data.activities?.streak_days || 0;
          
          qs.reportProgress(this.id, Math.min(streak, this.target), {
            streak_days: streak
          });
        });
    },
    
    onDeactivate(qs) {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    }
  }
};

// ============================================================================
// QUEST MANAGER - Main interface
// ============================================================================

const QuestManager = {
  initialized: false,
  
  // Initialize with Firebase
  init(firebase) {
    if (this.initialized) return;
    
    const user = firebase.auth().currentUser;
    if (!user?.uid) {
      console.warn('[QuestManager] No authenticated user');
      return;
    }
    
    QuestScripts.init(firebase, user.uid);
    this.initialized = true;
    
    // Auto-activate all quests that aren't completed
    this.bootstrapQuests();
    
    console.log('[QuestManager] Initialized');
  },
  
  // Bootstrap all available quests
  async bootstrapQuests() {
    const fb = QuestScripts.fb;
    const uid = QuestScripts.uid;
    if (!fb || !uid) return;
    
    // Create quest documents if they don't exist
    for (const [questId, quest] of Object.entries(QUEST_REGISTRY)) {
      const ref = fb.firestore()
        .collection('user_quests')
        .doc(uid)
        .collection('quests')
        .doc(questId);
      
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          quest_id: questId,
          title: quest.title,
          description: quest.description,
          reward: quest.reward,
          status: 'locked',
          progress: 0,
          target: quest.target || 1,
          created_at: fb.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Check if already in progress or claimable
        const data = snap.data();
        if (data.status !== 'completed') {
          // Activate for tracking
          QuestScripts.activate(questId);
        }
      }
    }
  },
  
  // Manually activate a quest
  activate(questId) {
    return QuestScripts.activate(questId);
  },
  
  // Deactivate a quest
  deactivate(questId) {
    QuestScripts.deactivate(questId);
  },
  
  // Track bubble bounce (helper for UI)
  trackBubbleBounce() {
    QuestRegistry.bubble_bounce.increment(QuestScripts);
  },
  
  // Track tile open (helper for UI)
  trackTileOpen(nodeId) {
    QuestRegistry.curious.trackTileOpen(QuestScripts, nodeId);
  },
  
  // Track article read (helper for UI)
  trackArticleRead() {
    QuestRegistry.daily_reader.trackArticleRead(QuestScripts);
  },
  
  // Get quest registry for display
  getQuests() {
    return Object.entries(QUEST_REGISTRY).map(([id, quest]) => ({
      id,
      title: quest.title,
      description: quest.description,
      reward: quest.reward,
      target: quest.target || 1
    }));
  }
};

// Register to window
window.QuestScripts = QuestScripts;
window.QuestRegistry = QUEST_REGISTRY;
window.QuestManager = QuestManager;

console.log('[QuestScripts] ✅ Module loaded');
