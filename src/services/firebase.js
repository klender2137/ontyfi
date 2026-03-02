import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || import.meta.env?.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || import.meta.env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || import.meta.env?.VITE_FIREBASE_APP_ID,
};

console.log('--- FIREBASE CONFIG LOADED ---', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log(`[Firebase Debug] SDK Initialized for Project: ${firebaseConfig.projectId}`);

export { db };
