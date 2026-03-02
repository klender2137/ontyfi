// Firebase Admin SDK initialization for backend services
// This file should be used by all backend services that need Firestore access

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

try {
  const serviceAccountPath = join(__dirname, '../public/crypto-explorer-2137-39f8d27496da.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  console.log('[Firebase Admin] Service account loaded:', {
    project_id: serviceAccount.project_id,
    client_email: serviceAccount.client_email
  });

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    console.log('[Firebase Admin] ✅ Initialized successfully with updated permissions');
    console.log('[Firebase Admin] Project:', serviceAccount.project_id);
  } else {
    console.log('[Firebase Admin] ✅ Already initialized');
  }

  db = admin.firestore();
  
  // Test connection
  db.collection('_test').limit(1).get()
    .then(() => console.log('[Firebase Admin] ✅ Firestore connection verified'))
    .catch(err => console.error('[Firebase Admin] ❌ Firestore connection failed:', err.message));

} catch (error) {
  console.error('[Firebase Admin] ❌ Initialization failed:', error.message);
  console.error('[Firebase Admin] Check service account file exists at: public/crypto-explorer-2137-39f8d27496da.json');
  
  // Create mock db to prevent crashes
  db = {
    collection: () => ({
      get: async () => ({ empty: true, size: 0, forEach: () => {} }),
      where: () => ({ get: async () => ({ empty: true, size: 0 }) }),
      orderBy: () => ({ limit: () => ({ get: async () => ({ empty: true, size: 0 }) }) }),
      limit: () => ({ get: async () => ({ empty: true, size: 0 }) }),
      doc: () => ({ 
        set: async () => { throw new Error('Firebase not initialized'); }, 
        get: async () => ({ exists: false }) 
      })
    }),
    batch: () => ({
      set: () => {},
      commit: async () => { throw new Error('Firebase not initialized'); }
    })
  };
  console.warn('[Firebase Admin] ⚠️ Using mock database - no real data operations possible');
}

export { db, admin };
