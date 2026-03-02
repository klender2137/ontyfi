// Firebase Admin SDK configuration for backend services
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;

try {
  // Check if Firebase Admin is already initialized
  if (!admin.apps.length) {
    // Load service account from file
    const serviceAccountPath = join(__dirname, '../../public/crypto-explorer-2137-firebase-adminsdk-fbsvc-0f3d6fb682.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('[Firebase Admin] Initialized successfully');
  }

  db = admin.firestore();
  
} catch (error) {
  console.error('[Firebase Admin] Initialization error:', error.message);
  throw error;
}

export { db, admin };
