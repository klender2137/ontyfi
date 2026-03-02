import { create } from 'zustand'

import { getAuth } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { deriveEncryptionKey, encryptData, decryptData, minifyJSON, parseJSON } from '../utils/cryptoUtils';

export const useAppStore = create((set, get) => ({
  // User data
  user: {
    username: 'crypto.explorer',
    preferences: { highlightKeywords: [] },
    activities: { streakDays: 0, totalArticlesRead: 0 }
  },
  
  // Bookmarks
  bookmarks: JSON.parse(localStorage.getItem('cryptoExplorer.bookmarks') || '[]'),
  
  // Tree data
  tree: null,
  treeLoading: false,
  treeError: null,
  
  // Actions
  setTree: (tree) => set({ tree, treeLoading: false, treeError: null }),
  setTreeLoading: (loading) => set({ treeLoading: loading }),
  setTreeError: (error) => set({ treeError: error, treeLoading: false }),
  
  toggleBookmark: (node) => set((state) => {
    const exists = state.bookmarks.some(b => b.id === node.id)
    const newBookmarks = exists 
      ? state.bookmarks.filter(b => b.id !== node.id)
      : [...state.bookmarks, node]
    
    localStorage.setItem('cryptoExplorer.bookmarks', JSON.stringify(newBookmarks))
    return { bookmarks: newBookmarks }
  }),
  
  isBookmarked: (nodeId) => get().bookmarks.some(b => b.id === nodeId),
  
  getUserInterests: () => {
    const { bookmarks, user } = get()
    const bookmarkTags = bookmarks.flatMap(b => b.tags || [])
    const keywordTags = user.preferences.highlightKeywords || []
    return [...new Set([...bookmarkTags, ...keywordTags])]
  },

  syncBookmarksWithFirebase: async () => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.log('[Firebase Debug] No authenticated user found for sync');
      return;
    }

    const userId = auth.currentUser.uid;
    console.log(`[Firebase Debug] Syncing bookmarks for user: ${userId}`);

    const signature = localStorage.getItem('walletSignature');
    if (!signature) {
      console.log('[Firebase Debug] No wallet signature found, cannot derive key');
      return;
    }

    const key = await deriveEncryptionKey(signature);
    const userDocRef = doc(db, 'users', userId);
    const currentBookmarks = get().bookmarks;
    console.log(`[Firebase Debug] Local favorites state: ${currentBookmarks.length} items`);

    try {
      // Perform sync operations without blocking app state
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const encrypted = data.favorites;
        if (encrypted) {
          const decrypted = await decryptData(key, encrypted);
          const remoteBookmarks = parseJSON(decrypted);
          console.log(`[Firebase Debug] Remote bookmarks found: ${remoteBookmarks.length} items`);

          // Update local state with remote data
          set({ bookmarks: remoteBookmarks });
          localStorage.setItem('cryptoExplorer.bookmarks', JSON.stringify(remoteBookmarks));
          console.log('[Firebase Debug] Local bookmarks updated from remote data');
        } else {
          console.log('[Firebase Debug] No encrypted favorites found');
        }
      } else {
        console.log('[Firebase Debug] No remote bookmarks found, will create new document');
      }

      // Save current bookmarks to Firestore (always do this to ensure data is saved)
      const dataToEncrypt = minifyJSON(currentBookmarks);
      const encrypted = await encryptData(key, dataToEncrypt);
      await setDoc(userDocRef, { favorites: encrypted }, { merge: true });
      console.log(`[Firebase Debug] Firestore successfully updated.`);

    } catch (error) {
      console.error(`[Firebase Error] Firestore sync failed: ${error.message}`);
      console.error('[Firebase Error] Full error details:', error);
    }
  },

  logViewActivity: async (hustleID) => {
    const firebaseAuth = getAuth();
    if (!firebaseAuth.currentUser) {
      console.log('[Analytics] No authenticated user for logging');
      return;
    }

    const userSignature = localStorage.getItem('walletSignature');
    if (!userSignature) {
      console.log('[Analytics] No signature for encryption');
      return;
    }

    try {
      const key = await deriveEncryptionKey(userSignature);
      const encryptedHustleID = await encryptData(key, hustleID);
      const historyRef = doc(db, firebaseAuth.currentUser.uid, 'history', Date.now().toString());
      await setDoc(historyRef, { hustleID: encryptedHustleID, timestamp: new Date() });
      console.log('[Analytics] View activity logged');
    } catch (error) {
      console.error('[Analytics] Failed to log view activity:', error);
    } finally {
      // No cleanup needed
    }
  }
}))