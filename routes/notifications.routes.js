import express from 'express';
import { admin } from '../services/firebase-admin.js';

const router = express.Router();

async function requireFirebaseUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  if (!token) {
    const err = new Error('Missing Authorization Bearer token');
    err.status = 401;
    throw err;
  }
  return admin.auth().verifyIdToken(token);
}

router.post('/register-token', async (req, res) => {
  try {
    const decoded = await requireFirebaseUser(req);
    const uid = decoded.uid;
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ ok: false, error: 'Missing token' });

    await admin.firestore().collection('users').doc(uid).set({
      fcm_tokens: admin.firestore.FieldValue.arrayUnion(token),
      fcm_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ ok: true });
  } catch (e) {
    res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Failed to register token' });
  }
});

router.post('/article-read', async (req, res) => {
  try {
    const decoded = await requireFirebaseUser(req);
    const uid = decoded.uid;

    const articleId = String(req.body?.articleId || '').trim();
    const articleTitle = String(req.body?.articleTitle || '').trim();
    const quizId = req.body?.quizId ? String(req.body.quizId).trim() : null;
    const url = req.body?.url ? String(req.body.url).trim() : null;
    const occurredAt = Number(req.body?.occurredAt) || Date.now();

    if (!articleId) return res.status(400).json({ ok: false, error: 'Missing articleId' });

    const jobRef = admin.firestore().collection('notification_jobs').doc();

    await jobRef.set({
      type: 'quiz_nudge',
      uid,
      articleId,
      articleTitle,
      quizId,
      url,
      sendAt: new Date(occurredAt + 60 * 60 * 1000),
      status: 'scheduled',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await admin.firestore().collection('users').doc(uid).set({
      'activities.last_article_read': { articleId, articleTitle, quizId: quizId || null, at: occurredAt },
      'activities.last_active_at': admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ ok: true });
  } catch (e) {
    res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Failed to record article read' });
  }
});

router.post('/quiz-attempt', async (req, res) => {
  try {
    const decoded = await requireFirebaseUser(req);
    const uid = decoded.uid;

    const quizId = String(req.body?.quizId || '').trim();
    const percent = Number(req.body?.percent) || 0;
    const pass = !!req.body?.pass;
    const occurredAt = Number(req.body?.occurredAt) || Date.now();

    if (!quizId) return res.status(400).json({ ok: false, error: 'Missing quizId' });

    await admin.firestore().collection('users').doc(uid).set({
      'activities.last_quiz_attempt': { quizId, percent, pass, at: occurredAt },
      'activities.last_active_at': admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ ok: true });
  } catch (e) {
    res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Failed to record quiz attempt' });
  }
});

export default router;
