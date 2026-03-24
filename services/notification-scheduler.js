import { admin } from './firebase-admin.js';

const TZ = 'Europe/Warsaw';

function now() {
  return new Date();
}

function withinSameDay(d1, d2) {
  return d1.getUTCFullYear() === d2.getUTCFullYear() && d1.getUTCMonth() === d2.getUTCMonth() && d1.getUTCDate() === d2.getUTCDate();
}

async function sendToUser(uid, payload) {
  const userSnap = await admin.firestore().collection('users').doc(uid).get();
  if (!userSnap.exists) return { ok: false, error: 'User not found' };
  const user = userSnap.data() || {};
  const tokens = Array.isArray(user.fcm_tokens) ? user.fcm_tokens : [];
  if (!tokens.length) return { ok: false, error: 'No tokens' };

  const message = {
    tokens,
    notification: payload.notification,
    data: payload.data || {},
    android: {
      priority: 'high'
    }
  };

  const resp = await admin.messaging().sendEachForMulticast(message);
  return { ok: true, resp };
}

async function processQuizNudges() {
  const cutoff = new Date(Date.now() + 5000);
  const snap = await admin.firestore()
    .collection('notification_jobs')
    .where('type', '==', 'quiz_nudge')
    .where('status', '==', 'scheduled')
    .where('sendAt', '<=', cutoff)
    .limit(50)
    .get();

  if (snap.empty) return;

  for (const doc of snap.docs) {
    const job = doc.data() || {};
    const uid = job.uid;
    const quizId = job.quizId;

    // if no quiz attached, skip
    if (!uid || !quizId) {
      await doc.ref.set({ status: 'skipped', processed_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }

    // check if attempted/completed already
    let attempted = false;
    try {
      const userSnap = await admin.firestore().collection('users').doc(uid).get();
      const u = userSnap.exists ? (userSnap.data() || {}) : {};
      const quizStats = u.profile?.quiz_stats || {};
      attempted = !!quizStats?.[quizId];
    } catch {
      attempted = false;
    }

    if (attempted) {
      await doc.ref.set({ status: 'skipped', reason: 'already_attempted', processed_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }

    const title = 'Quiz reminder';
    const body = job.articleTitle ? `1h ago you read "${job.articleTitle}". Want to try its quiz?` : 'Want to try the quiz for the last article you read?';

    try {
      await sendToUser(uid, {
        notification: { title, body },
        data: { url: job.url || '/', quizId: quizId, articleId: job.articleId || '' }
      });
      await doc.ref.set({ status: 'sent', sent_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) {
      await doc.ref.set({ status: 'error', error: e?.message || String(e), processed_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
  }
}

async function processDailyBranchReminderWindow(windowKey, startHour, startMin, spanMin) {
  // This is a lightweight "random within window" mechanism:
  // at the start of the window, pick a random minute offset and store per-day per-user schedule.
  const usersSnap = await admin.firestore().collection('users').limit(200).get();
  const today = now();

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const user = userDoc.data() || {};

    const metaKey = `notifications.${windowKey}`;
    const meta = user.notifications?.[windowKey] || null;

    let shouldSchedule = true;
    if (meta && meta.day && meta.at) {
      const day = new Date(meta.day);
      if (withinSameDay(day, today)) {
        shouldSchedule = false;
      }
    }

    if (!shouldSchedule) continue;

    const offset = Math.floor(Math.random() * spanMin);
    const sendAt = new Date();
    sendAt.setHours(startHour, startMin, 0, 0);
    sendAt.setMinutes(sendAt.getMinutes() + offset);

    await admin.firestore().collection('users').doc(uid).set({
      notifications: {
        ...(user.notifications || {}),
        [windowKey]: {
          day: today.toISOString(),
          at: sendAt.toISOString(),
          status: 'scheduled'
        }
      }
    }, { merge: true });

    await admin.firestore().collection('notification_jobs').add({
      type: 'branch_reminder',
      uid,
      windowKey,
      sendAt,
      status: 'scheduled',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function processBranchReminders() {
  const cutoff = new Date(Date.now() + 5000);
  const snap = await admin.firestore()
    .collection('notification_jobs')
    .where('type', '==', 'branch_reminder')
    .where('status', '==', 'scheduled')
    .where('sendAt', '<=', cutoff)
    .limit(50)
    .get();

  if (snap.empty) return;

  for (const doc of snap.docs) {
    const job = doc.data() || {};
    const uid = job.uid;
    if (!uid) continue;

    // simplistic completion: based on quiz_stats pass/fail vs total completed.
    let completionPct = 0;
    try {
      const userSnap = await admin.firestore().collection('users').doc(uid).get();
      const u = userSnap.exists ? (userSnap.data() || {}) : {};
      const stats = u.profile?.quiz_stats || {};
      const completed = Object.keys(stats).length;
      const target = Math.max(1, Number(u.profile?.learning_stats?.started_branch_quiz_target) || 10);
      completionPct = Math.min(100, Math.round((completed / target) * 100));
    } catch {
      completionPct = 0;
    }

    const title = 'Learning progress';
    const body = `Your current branch completion is ${completionPct}%. ${100 - completionPct}% left to finish.`;

    try {
      await sendToUser(uid, {
        notification: { title, body },
        data: { url: '/?screen=level-up' }
      });
      await doc.ref.set({ status: 'sent', sent_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) {
      await doc.ref.set({ status: 'error', error: e?.message || String(e) }, { merge: true });
    }
  }
}

async function processCareerGrafting() {
  const usersSnap = await admin.firestore().collection('users').limit(200).get();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const user = userDoc.data() || {};

    const targetJob = user.profile?.target_job || user.target_job;
    const requiredSkills = user.profile?.target_job_skills || user.target_job_skills;
    if (!targetJob || !Array.isArray(requiredSkills) || requiredSkills.length === 0) continue;

    const lastVisits = user.stats?.last_skill_visit || user.profile?.last_skill_visit || {};
    const missing = requiredSkills.find((skillId) => {
      const t = lastVisits?.[skillId];
      const ms = typeof t === 'number' ? t : (t?.toMillis ? t.toMillis() : null);
      return !ms || ms < weekAgo;
    });

    if (!missing) continue;

    const title = 'Career Path Alert';
    const body = `To reach '${targetJob}', you still need to bridge the '${missing}' gap. 5 mins to start?`;

    await sendToUser(uid, {
      notification: { title, body },
      data: { url: '/?screen=tree' }
    }).catch(() => {});
  }
}

async function processStreakProtector() {
  const usersSnap = await admin.firestore().collection('users').limit(200).get();
  const nowMs = Date.now();

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const user = userDoc.data() || {};

    const streakDays = Number(user.activities?.streakDays || user.profile?.streakDays || 0);
    if (streakDays < 5) continue;

    const lastActive = user.activities?.last_active_at;
    const lastActiveMs = lastActive?.toMillis ? lastActive.toMillis() : (typeof lastActive === 'number' ? lastActive : null);
    if (!lastActiveMs) continue;

    // if inactive for ~20h, nudge to protect streak
    if (nowMs - lastActiveMs < 20 * 60 * 60 * 1000) continue;

    const title = 'Streak Protector';
    const body = `Your ${streakDays}-day learning streak is glowing. Log in to keep your learning curve.`;

    await sendToUser(uid, {
      notification: { title, body },
      data: { url: '/' }
    }).catch(() => {});
  }
}

function startSchedulers() {
  // due job processors
  setInterval(() => {
    processQuizNudges().catch(() => {});
    processBranchReminders().catch(() => {});
  }, 60 * 1000);

  // window schedulers (runs every 30 minutes, schedules once per day per window per user)
  setInterval(() => {
    processDailyBranchReminderWindow('morning', 8, 30, 120).catch(() => {});
    processDailyBranchReminderWindow('evening', 18, 30, 60).catch(() => {});
  }, 30 * 60 * 1000);

  // career + streak checks every 6h
  setInterval(() => {
    processCareerGrafting().catch(() => {});
    processStreakProtector().catch(() => {});
  }, 6 * 60 * 60 * 1000);
}

startSchedulers();
