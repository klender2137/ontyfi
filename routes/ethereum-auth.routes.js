import express from 'express';
import crypto from 'crypto';
import { SiweMessage } from 'siwe';
import { admin, db } from '../services/firebase-admin.js';

const router = express.Router();

router.get('/nonce', async (req, res) => {
  try {
    const nonce = crypto.randomBytes(16).toString('hex');
    const id = crypto.randomBytes(8).toString('hex'); // unique id for nonce
    const ref = db.collection('ethereum_nonces').doc(id);

    await ref.set({
      nonce,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ nonce });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to issue nonce' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { message, signature } = req.body || {};

    if (!message || !signature) {
      return res.status(400).json({ error: 'message and signature are required' });
    }

    const siweMessage = new SiweMessage(message);
    const verification = await siweMessage.verify({ signature });

    if (!verification.success) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Check nonce
    const nonce = siweMessage.nonce;
    const nonceQuery = db.collection('ethereum_nonces').where('nonce', '==', nonce);
    const snap = await nonceQuery.get();

    if (snap.empty) {
      return res.status(400).json({ error: 'Invalid nonce' });
    }

    // Delete all matching nonces (consume)
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    const address = siweMessage.address;

    let uid = null;
    const existingQuery = await db
      .collection('users')
      .where('wallet_address', '==', address)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      uid = existingQuery.docs[0].id;
    } else {
      uid = `ethereum:${address}`;
    }

    await db.collection('users').doc(uid).set({
      uid,
      wallet_address: address,
      identities: admin.firestore.FieldValue.arrayUnion('ethereum'),
      metadata: {
        last_login: admin.firestore.FieldValue.serverTimestamp(),
        last_active: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });

    const token = await admin.auth().createCustomToken(uid, {
      wallet_address: address,
      auth_type: 'ethereum',
    });

    return res.json({ token, uid });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

export default router;
