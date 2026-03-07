import express from 'express';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { admin, db } from '../services/firebase-admin.js';

const router = express.Router();

function getMessageToSign({ walletAddress, nonce }) {
  return `CryptoExplorer Sign-In\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

router.get('/nonce', async (req, res) => {
  try {
    const walletAddress = String(req.query.walletAddress || '').trim();
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const ref = db.collection('solana_nonces').doc(walletAddress);

    await ref.set({
      wallet_address: walletAddress,
      nonce,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const message = getMessageToSign({ walletAddress, nonce });
    return res.json({ walletAddress, nonce, message });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to issue nonce' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { walletAddress, signatureBase64, message } = req.body || {};

    if (!walletAddress || !signatureBase64 || !message) {
      return res.status(400).json({ error: 'walletAddress, signatureBase64, and message are required' });
    }

    const walletRef = db.collection('solana_nonces').doc(walletAddress);
    const snap = await walletRef.get();
    if (!snap.exists) {
      return res.status(400).json({ error: 'Missing nonce. Please request a new nonce.' });
    }

    const { nonce } = snap.data();
    const expectedMessage = getMessageToSign({ walletAddress, nonce });

    if (message !== expectedMessage) {
      return res.status(400).json({ error: 'Message does not match expected nonce payload' });
    }

    const publicKeyBytes = new PublicKey(walletAddress).toBytes();
    const signatureBytes = Buffer.from(signatureBase64, 'base64');
    const messageBytes = Buffer.from(message, 'utf8');

    const ok = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    await walletRef.delete();

    let uid = null;
    const existingQuery = await db
      .collection('users')
      .where('wallet_address', '==', walletAddress)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      uid = existingQuery.docs[0].id;
    } else {
      uid = `solana:${walletAddress}`;
    }

    await db.collection('users').doc(uid).set({
      uid,
      wallet_address: walletAddress,
      identities: admin.firestore.FieldValue.arrayUnion('phantom'),
      metadata: {
        last_login: admin.firestore.FieldValue.serverTimestamp(),
        last_active: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });

    const token = await admin.auth().createCustomToken(uid, {
      wallet_address: walletAddress,
      auth_type: 'phantom',
    });

    return res.json({ token, uid });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

export default router;
