// Firebase connection test
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBl4n35lHVR9EHS_fi7slR28xIJeMoFM4k",
  authDomain: "crypto-explorer-2137.firebaseapp.com",
  projectId: "crypto-explorer-2137",
  storageBucket: "crypto-explorer-2137.firebasestorage.app",
  messagingSenderId: "970851515463",
  appId: "1:970851515463:web:3b3d9c44b4367a373cc562"
};

try {
  console.log('Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  console.log('Firebase initialized successfully');

  // Test connection by trying to access a collection
  console.log('Testing Firestore connection...');
  const testCollection = collection(db, 'global_trends');
  getDocs(testCollection).then((snapshot) => {
    console.log('Firestore connection successful. Documents in global_trends:', snapshot.size);
  }).catch((error) => {
    console.error('Firestore connection failed:', error);
  });

} catch (error) {
  console.error('Firebase initialization failed:', error);
}
