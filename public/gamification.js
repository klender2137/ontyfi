(function registerGamificationEngine() {
  try {
    if (typeof window === 'undefined') return;

    if (window.Gamification && typeof window.Gamification === 'object') {
      console.log('[Gamification] Already registered');
      return;
    }

    const QUEST_DEFS = {
      wallet_link: {
        id: 'wallet_link',
        title: 'Attach Wallet',
        description: 'Connect a wallet to your account',
        reward: 50
      },
      visit_all_screens: {
        id: 'visit_all_screens',
        title: 'Visit All Screens',
        description: 'Open the Tree, Explore, and Level Up screens',
        reward: 100
      },
      bubble_bounce: {
        id: 'bubble_bounce',
        title: 'Bubble Bounce',
        description: 'Pop tag bubbles 25 times',
        reward: 150,
        target: 25
      },
      curious: {
        id: 'curious',
        title: 'Curious Explorer',
        description: 'Open all 9 core tiles in the TreeMap',
        reward: 50,
        target: 9
      }
    };

    const LEVELS_MAX = 15;
    const LEVEL_BASE_POINTS = 100;

    function maskWallet(addr) {
      if (!addr || typeof addr !== 'string') return 'Anonymous';
      if (addr.length <= 10) return addr;
      return addr.slice(0, 6) + '…' + addr.slice(-4);
    }

    function calculateLevel(totalPoints) {
      const points = Math.max(0, Number(totalPoints) || 0);
      let level = 1;
      let requiredForNext = LEVEL_BASE_POINTS;

      while (level < LEVELS_MAX && points >= requiredForNext) {
        level += 1;
        requiredForNext += LEVEL_BASE_POINTS * Math.pow(2, level - 2);
      }

      return level;
    }

    function pointsRequiredForLevel(level) {
      const lvl = Math.min(Math.max(1, Number(level) || 1), LEVELS_MAX);
      if (lvl <= 1) return 0;

      let total = 0;
      for (let l = 2; l <= lvl; l += 1) {
        total += LEVEL_BASE_POINTS * Math.pow(2, l - 2);
      }
      return total;
    }

    function getFirebase() {
      return typeof window.firebase !== 'undefined' ? window.firebase : null;
    }

    function getAuthedUser() {
      const fb = getFirebase();
      if (!fb || !fb.auth) return null;
      return fb.auth().currentUser || null;
    }

    async function ensureUserDocFields(user) {
      const fb = getFirebase();
      if (!fb || !fb.firestore || !user?.uid) return;

      const ref = fb.firestore().collection('users').doc(user.uid);
      const snap = await ref.get();

      const patch = {
        nickname: user.displayName || null,
        croin_balance: 0,
        lifetime_points: 0,
        level: 1,
        in_app_time_ms: 0,
        preferred_crypto_field: null,
        quests_completed: [],
        stats: {
          bubble_bounces: 0,
          screens_visited: []
        },
        wallet_address: null
      };

      if (!snap.exists) {
        await ref.set({
          uid: user.uid,
          email: user.email ?? null,
          created_at: new Date(),
          last_seen: new Date(),
          ...patch
        }, { merge: true });
        return;
      }

      const data = snap.data() || {};
      const update = {};

      if (typeof data.croin_balance !== 'number') update.croin_balance = 0;
      if (typeof data.lifetime_points !== 'number') update.lifetime_points = 0;
      if (typeof data.level !== 'number') update.level = 1;
      if (typeof data.in_app_time_ms !== 'number') update.in_app_time_ms = 0;
      if (!Array.isArray(data.quests_completed)) update.quests_completed = [];

      if (!data.stats || typeof data.stats !== 'object') {
        update.stats = patch.stats;
      } else {
        if (typeof data.stats.bubble_bounces !== 'number') update['stats.bubble_bounces'] = 0;
        if (!Array.isArray(data.stats.screens_visited)) update['stats.screens_visited'] = [];
      }

      if (data.nickname == null && user.displayName) update.nickname = user.displayName;
      if (!data.last_seen) update.last_seen = new Date();

      if (Object.keys(update).length > 0) {
        await ref.set(update, { merge: true });
      }
    }

    async function ensureQuestDoc(uid, questId) {
      const fb = getFirebase();
      if (!fb || !fb.firestore || !uid) return;

      const def = QUEST_DEFS[questId];
      if (!def) return;

      const ref = fb.firestore().collection('user_quests').doc(uid).collection('quests').doc(questId);
      const snap = await ref.get();
      if (snap.exists) return;

      await ref.set({
        quest_id: questId,
        title: def.title,
        description: def.description,
        reward: def.reward,
        status: 'locked',
        progress: 0,
        target: def.target ?? null,
        created_at: fb.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    async function bootstrapQuests(uid) {
      await Promise.all(Object.keys(QUEST_DEFS).map((id) => ensureQuestDoc(uid, id)));
    }

    async function startQuest(questId) {
      const fb = getFirebase();
      const user = getAuthedUser();
      if (!fb || !fb.firestore || !user?.uid) return;

      await ensureQuestDoc(user.uid, questId);
      const ref = fb.firestore().collection('user_quests').doc(user.uid).collection('quests').doc(questId);

      await fb.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data() || {};
        if (data.status === 'completed') return;
        if (data.status === 'claimable') return;
        tx.set(ref, { status: 'in_progress', started_at: fb.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
    }

    async function setQuestClaimableIfEligible(uid, questId, eligibilityFn) {
      const fb = getFirebase();
      if (!fb || !fb.firestore || !uid) return;

      const ref = fb.firestore().collection('user_quests').doc(uid).collection('quests').doc(questId);

      await fb.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data() || {};
        if (data.status === 'completed' || data.status === 'claimable') return;

        const eligible = await eligibilityFn(tx);
        if (!eligible) return;

        tx.set(ref, { status: 'claimable', claimable_at: fb.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
    }

    async function claimQuest(questId) {
      const fb = getFirebase();
      const user = getAuthedUser();
      if (!fb || !fb.firestore || !user?.uid) return { ok: false, error: 'Not authenticated' };

      const def = QUEST_DEFS[questId];
      if (!def) return { ok: false, error: 'Unknown quest' };

      const questRef = fb.firestore().collection('user_quests').doc(user.uid).collection('quests').doc(questId);
      const userRef = fb.firestore().collection('users').doc(user.uid);

      try {
        await fb.firestore().runTransaction(async (tx) => {
          const questSnap = await tx.get(questRef);
          const userSnap = await tx.get(userRef);

          if (!questSnap.exists) throw new Error('Quest not found');
          const q = questSnap.data() || {};
          if (q.status !== 'claimable') throw new Error('Quest not claimable');

          const u = userSnap.exists ? (userSnap.data() || {}) : {};
          const currentBalance = Number(u.croin_balance) || 0;
          const currentLifetime = Number(u.lifetime_points) || 0;
          const newBalance = currentBalance + def.reward;
          const newLifetime = currentLifetime + def.reward;
          const newLevel = calculateLevel(newLifetime);

          tx.set(userRef, {
            croin_balance: newBalance,
            balance: newBalance, // Persistent balance value
            lifetime_points: newLifetime,
            level: newLevel,
            last_seen: fb.firestore.FieldValue.serverTimestamp(),
            quests_completed: fb.firestore.FieldValue.arrayUnion(questId)
          }, { merge: true });

          tx.set(questRef, {
            status: 'completed',
            completed_at: fb.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });

        return { ok: true };
      } catch (e) {
        return { ok: false, error: e?.message || 'Claim failed' };
      }
    }

    async function syncAttachWalletQuest() {
      const fb = getFirebase();
      const user = getAuthedUser();
      if (!fb || !fb.firestore || !user?.uid) return;

      await ensureQuestDoc(user.uid, 'wallet_link');

      const userRef = fb.firestore().collection('users').doc(user.uid);

      let walletAddress = null;
      try {
        const snap = await userRef.get();
        const data = snap.exists ? (snap.data() || {}) : {};
        walletAddress = data.wallet_address || null;
      } catch {
        walletAddress = null;
      }

      if (!walletAddress) return;

      const questRef = fb.firestore().collection('user_quests').doc(user.uid).collection('quests').doc('wallet_link');
      await fb.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(questRef);
        if (!snap.exists) return;
        const data = snap.data() || {};
        if (data.status === 'completed' || data.status === 'claimable') return;
        tx.set(questRef, { status: 'claimable', claimable_at: fb.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
    }

    async function trackScreenVisit(screen) {
      const fb = getFirebase();
      const user = getAuthedUser();
      if (!fb || !fb.firestore || !user?.uid) return;

      const userRef = fb.firestore().collection('users').doc(user.uid);
      await userRef.set({
        last_seen: fb.firestore.FieldValue.serverTimestamp(),
        'stats.screens_visited': fb.firestore.FieldValue.arrayUnion(String(screen))
      }, { merge: true });

      await ensureQuestDoc(user.uid, 'visit_all_screens');
      const questRef = fb.firestore().collection('user_quests').doc(user.uid).collection('quests').doc('visit_all_screens');

      const required = ['tree', 'explore', 'my-hustle', 'level-up'];

      let visited = [];
      try {
        const snap = await userRef.get();
        const u = snap.exists ? (snap.data() || {}) : {};
        visited = Array.isArray(u.stats?.screens_visited) ? u.stats.screens_visited : [];
      } catch {
        visited = [];
      }

      const allDone = required.every((s) => visited.includes(s));
      const progress = visited.filter((v) => required.includes(v)).length;

      await fb.firestore().runTransaction(async (tx) => {
        const questSnap = await tx.get(questRef);
        if (!questSnap.exists) return;

        const q = questSnap.data() || {};
        if (q.status === 'completed' || q.status === 'claimable') return;

        if (allDone) {
          tx.set(questRef, { status: 'claimable', progress: required.length, target: required.length }, { merge: true });
        } else {
          tx.set(questRef, { status: q.status === 'locked' ? 'in_progress' : q.status, progress, target: required.length }, { merge: true });
        }
      });
    }

    async function incrementInAppTime(deltaMs) {
      const fb = getFirebase();
      const user = getAuthedUser();
      if (!fb || !fb.firestore || !user?.uid) return;

      const userRef = fb.firestore().collection('users').doc(user.uid);
      await userRef.set({
        in_app_time_ms: fb.firestore.FieldValue.increment(Number(deltaMs) || 0),
        last_seen: fb.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    async function trackBubbleBounce() {
      const fb = getFirebase();
      const user = getAuthedUser();
      if (!fb || !fb.firestore || !user?.uid) return;

      const userRef = fb.firestore().collection('users').doc(user.uid);
      const questRef = fb.firestore().collection('user_quests').doc(user.uid).collection('quests').doc('bubble_bounce');

      await fb.firestore().runTransaction(async (tx) => {
        const qSnap = await tx.get(questRef);
        if (!qSnap.exists) return;
        const q = qSnap.data() || {};
        
        // One-time completion check
        if (q.status === 'completed' || q.status === 'claimable') return;

        const target = Number(q.target) || QUEST_DEFS.bubble_bounce.target || 25;
        const nextProgress = (Number(q.progress) || 0) + 1;

        tx.set(userRef, { 'stats.bubble_bounces': fb.firestore.FieldValue.increment(1) }, { merge: true });

        if (nextProgress >= target) {
          tx.set(questRef, { progress: target, status: 'claimable' }, { merge: true });
        } else {
          tx.set(questRef, { progress: nextProgress, status: 'in_progress', target }, { merge: true });
        }
      });
    }

    function subscribeUserProfile(callback) {
      const fb = getFirebase();
      const user = getAuthedUser();
      if (!fb || !fb.firestore || !user?.uid) return () => {};

      const ref = fb.firestore().collection('users').doc(user.uid);
      return ref.onSnapshot((snap) => {
        callback(snap.exists ? snap.data() : null);
      }, (err) => {
        console.warn('[Gamification] user profile snapshot error', err);
        callback(null);
      });
    }

    function subscribeUserQuests(callback) {
      const fb = getFirebase();
      const user = getAuthedUser();
      if (!fb || !fb.firestore || !user?.uid) return () => {};

      const ref = fb.firestore().collection('user_quests').doc(user.uid).collection('quests');
      return ref.onSnapshot((snap) => {
        const quests = [];
        snap.forEach((d) => quests.push({ id: d.id, ...(d.data() || {}) }));
        callback(quests);
      }, (err) => {
        console.warn('[Gamification] quests snapshot error', err);
        callback([]);
      });
    }

    function subscribeLeaderboard(limit) {
      const fb = getFirebase();
      if (!fb || !fb.firestore) return { unsubscribe: () => {} };

      const ref = fb.firestore().collection('users').orderBy('croin_balance', 'desc').limit(Math.max(1, Math.min(50, Number(limit) || 20)));
      const unsub = ref.onSnapshot((snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() || {}) }));
        try {
          window.dispatchEvent(new CustomEvent('LeaderboardUpdated', { detail: rows }));
        } catch {}
      }, (err) => {
        console.warn('[Gamification] leaderboard snapshot error', err);
      });

      return { unsubscribe: unsub };
    }

    async function initForCurrentUser() {
      const user = getAuthedUser();
      if (!user?.uid) return;
      await ensureUserDocFields(user);
      await bootstrapQuests(user.uid);
      await syncAttachWalletQuest();
    }

    function init() {
      const fb = getFirebase();
      if (!fb || !fb.auth) return;

      fb.auth().onAuthStateChanged(async (user) => {
        if (user?.uid) {
          try {
            await initForCurrentUser();
          } catch (e) {
            console.warn('[Gamification] init error', e);
          }
        }
      });
    }

    async function loadQuestFromMD(questId) {
      try {
        const response = await fetch(`/data/quests/${questId}.md`);
        if (!response.ok) return null;
        const text = await response.text();
        const lines = text.split('\n');
        const quest = { id: questId };
        
        lines.forEach(line => {
          if (line.startsWith('# TITLE:')) quest.title = line.replace('# TITLE:', '').trim();
          if (line.startsWith('# DESCRIPTION:')) quest.description = line.replace('# DESCRIPTION:', '').trim();
          if (line.startsWith('# REWARD:')) quest.reward = parseInt(line.replace('# REWARD:', '').trim());
          if (line.startsWith('# TARGET:')) quest.target = parseInt(line.replace('# TARGET:', '').trim());
        });
        
        const scriptMatch = text.match(/# SCRIPT:\s*([\s\S]*)/);
        if (scriptMatch && scriptMatch[1]) {
          quest.script = scriptMatch[1].trim();
        }
        
        return quest;
      } catch (e) {
        console.warn(`[Gamification] Failed to load quest MD for ${questId}:`, e);
        return null;
      }
    }

    async function trackTileOpen(nodeId) {
      const fb = getFirebase();
      const user = getAuthedUser();
      if (!fb || !fb.firestore || !user?.uid) return;

      const userRef = fb.firestore().collection('users').doc(user.uid);
      const questRef = fb.firestore().collection('user_quests').doc(user.uid).collection('quests').doc('curious');
      
      const snap = await userRef.get();
      const data = snap.data() || {};
      const openedTiles = data.stats?.opened_core_tiles || [];
      
      if (!openedTiles.includes(nodeId)) {
        await userRef.set({
          'stats.opened_core_tiles': fb.firestore.FieldValue.arrayUnion(nodeId)
        }, { merge: true });
        
        const nextCount = openedTiles.length + 1;
        const target = QUEST_DEFS.curious.target;

        await fb.firestore().runTransaction(async (tx) => {
          const qSnap = await tx.get(questRef);
          if (!qSnap.exists) return;
          const q = qSnap.data() || {};
          if (q.status === 'completed' || q.status === 'claimable') return;

          if (nextCount >= target) {
            tx.set(questRef, { status: 'claimable', progress: target }, { merge: true });
          } else {
            tx.set(questRef, { status: 'in_progress', progress: nextCount }, { merge: true });
          }
        });
      }
    }

    window.Gamification = {
      QUEST_DEFS,
      calculateLevel,
      pointsRequiredForLevel,
      maskWallet,
      init,
      initForCurrentUser,
      ensureUserDocFields,
      bootstrapQuests,
      startQuest,
      claimQuest,
      syncAttachWalletQuest,
      trackScreenVisit,
      incrementInAppTime,
      trackBubbleBounce,
      trackTileOpen,
      loadQuestFromMD,
      subscribeUserProfile,
      subscribeUserQuests,
      subscribeLeaderboard
    };

    console.log('[Gamification] ✅ Registered');
    try {
      window.dispatchEvent(new Event('GamificationReady'));
    } catch {}
  } catch (e) {
    console.error('[Gamification] Failed to register', e);
  }
})();
