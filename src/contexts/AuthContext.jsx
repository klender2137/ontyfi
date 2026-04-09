import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { arrayUnion, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAppStore } from '../store/useAppStore';

const AuthContext = createContext(null);

function validateEmail(email) {
  // Minimal RFC 5322-ish; enough for client-side sanity
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  // Basic strength: 8+ with at least 1 letter and 1 number
  if (typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

async function ensureUserDoc({ user, authType, linkedinId = null, linkedinSub = null }) {
  if (!user?.uid) return;

  const identity = authType === 'email' ? 'password' : authType;

  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');

    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? null,
      linkedin_id: linkedinId,
      linkedin_sub: linkedinSub,
      identities: identity ? [identity] : [],
      metadata: {
        created_at: serverTimestamp(),
        last_login: serverTimestamp(),
        last_active: serverTimestamp(),
      },
      display_name: displayName,
      auth_type: authType,
      created_at: serverTimestamp(),
      preferences: {
        mev_alerts: true,
        yield_filters: ['stablecoins', 'high_tvl'],
        theme: 'dark',
      },
      account_level: 'free',
    });

    return;
  }

  const existing = snap.data();
  const patch = {};

  if (existing.auth_type !== authType && authType) patch.auth_type = authType;
  if ((existing.email ?? null) !== (user.email ?? null)) patch.email = user.email ?? null;
  if (linkedinSub && (existing.linkedin_sub ?? null) !== (linkedinSub ?? null)) patch.linkedin_sub = linkedinSub;
  if (linkedinId && (existing.linkedin_id ?? null) !== (linkedinId ?? null)) patch.linkedin_id = linkedinId;
  if (!existing.display_name && (user.displayName || user.email)) {
    patch.display_name = user.displayName || user.email.split('@')[0];
  }

  if (identity) {
    patch.identities = arrayUnion(identity);
  }

  patch['metadata.last_login'] = serverTimestamp();
  patch['metadata.last_active'] = serverTimestamp();

  if (Object.keys(patch).length > 0) {
    await updateDoc(ref, patch);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [pendingGoogleLink, setPendingGoogleLink] = useState(null);

  const { initializeBookmarksForUser } = useAppStore();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser ?? null);

      // Initialize bookmarks for the current user state
      if (firebaseUser?.uid) {
        console.log(`[AuthContext] User authenticated: ${firebaseUser.uid}, initializing bookmarks`);
        initializeBookmarksForUser(firebaseUser.uid);
      } else {
        console.log('[AuthContext] No authenticated user, clearing bookmarks');
        initializeBookmarksForUser(null);
      }

      if (firebaseUser) {
        setIsGuest(false);
        try {
          const providerIds = firebaseUser.providerData?.map((p) => p?.providerId).filter(Boolean) || [];
          const isGoogle = providerIds.includes('google.com');
          const isEmail = providerIds.includes('password');

          const authType = isGoogle ? 'google' : isEmail ? 'email' : 'email';
          await ensureUserDoc({ user: firebaseUser, authType });
        } catch (e) {
          setError(e?.message || 'Failed to sync user profile');
        }
      }

      setInitializing(false);
    });

    return unsubscribe;
  }, [initializeBookmarksForUser]);

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
    setError(null);
  }, []);

  const signUpWithEmail = useCallback(async ({ email, password, displayName }) => {
    setError(null);
    if (!validateEmail(email)) throw new Error('Invalid email');
    if (!validatePassword(password)) throw new Error('Password must be at least 8 characters and include a letter and a number');

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName && typeof displayName === 'string' && displayName.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }

    await ensureUserDoc({ user: credential.user, authType: 'email' });
    setIsGuest(false);

    return credential.user;
  }, []);

  const signInWithEmail = useCallback(async ({ email, password }) => {
    setError(null);
    if (!validateEmail(email)) throw new Error('Invalid email');
    if (!password) throw new Error('Password is required');

    const credential = await signInWithEmailAndPassword(auth, email, password);

    await ensureUserDoc({ user: credential.user, authType: 'email' });
    setIsGuest(false);

    return credential.user;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const provider = new GoogleAuthProvider();

    try {
      const credential = await signInWithPopup(auth, provider);
      await ensureUserDoc({ user: credential.user, authType: 'google' });
      setIsGuest(false);
      return credential.user;
    } catch (e) {
      // If email exists with a different provider, link accounts
      const email = e?.customData?.email;
      if (e?.code === 'auth/account-exists-with-different-credential' && email) {
        const pendingCred = GoogleAuthProvider.credentialFromError(e);
        const methods = await fetchSignInMethodsForEmail(auth, email);

        if (methods.includes('password')) {
          if (pendingCred) {
            setPendingGoogleLink({ email, credential: pendingCred });
          }
          throw new Error('This email is registered with password. Sign in with email/password to link Google.');
        }

        // If it exists with some provider, we can't auto-sign-in unless we handle that provider.
        if (!pendingCred) throw e;

        // As a fallback, if a user is already signed in, link the credential
        if (auth.currentUser) {
          await linkWithCredential(auth.currentUser, pendingCred);
          await ensureUserDoc({ user: auth.currentUser, authType: 'google' });
          setIsGuest(false);
          return auth.currentUser;
        }
      }

      throw e;
    }
  }, []);

  const linkGoogleWithPassword = useCallback(async ({ email, password }) => {
    setError(null);
    if (!pendingGoogleLink?.credential || !pendingGoogleLink?.email) {
      throw new Error('No pending Google credential to link');
    }
    if (pendingGoogleLink.email !== email) {
      throw new Error('Email does not match pending Google sign-in attempt');
    }
    if (!validateEmail(email)) throw new Error('Invalid email');
    if (!password) throw new Error('Password is required');

    const signInCred = await signInWithEmailAndPassword(auth, email, password);
    await linkWithCredential(signInCred.user, pendingGoogleLink.credential);
    await ensureUserDoc({ user: signInCred.user, authType: 'google' });
    setPendingGoogleLink(null);
    setIsGuest(false);
    return signInCred.user;
  }, [pendingGoogleLink]);

  const clearPendingGoogleLink = useCallback(() => {
    setPendingGoogleLink(null);
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid;
    
    await firebaseSignOut(auth);
    setIsGuest(false);
    
    // Clear user-specific bookmarks after sign out
    if (userId) {
      const userBookmarkKey = `cryptoExplorer.bookmarks.${userId}`;
      localStorage.removeItem(userBookmarkKey);
    }
    
    console.log('[AuthContext] User signed out, bookmarks cleared');
  }, []);

  const deleteAccount = useCallback(async () => {
    setError(null);

    const current = auth.currentUser;
    if (!current?.uid) {
      throw new Error('No authenticated user');
    }

    const uid = current.uid;

    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (e) {
      // Continue - we still want to attempt auth deletion.
      console.warn('[AuthContext] Failed to delete Firestore user doc:', e);
    }

    try {
      // Client-side deletion can fail if login is stale; surface a clear message.
      await deleteUser(current);
    } catch (e) {
      const code = e?.code;
      if (code === 'auth/requires-recent-login') {
        throw new Error('Please sign in again, then retry deleting your account (Firebase requires a recent login).');
      }
      throw e;
    } finally {
      try {
        // Clear user-specific bookmarks
        if (current?.uid) {
          const userBookmarkKey = `cryptoExplorer.bookmarks.${current.uid}`;
          localStorage.removeItem(userBookmarkKey);
        }
        // Also clear the old global bookmarks key for cleanup
        localStorage.removeItem('cryptoExplorer.bookmarks');
        localStorage.removeItem('cryptoExplorer.bookmarks.guest');
      } catch {
        // ignore
      }
    }
  }, []);

  // LinkedIn OIDC sign-in
  const signInWithLinkedIn = useCallback(async () => {
    setError(null);

    try {
      // Initiate LinkedIn OAuth flow
      const response = await fetch('/api/auth/linkedin');
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to initiate LinkedIn authentication');
      }

      const { authUrl } = await response.json();
      if (!authUrl) throw new Error('Missing authorization URL');

      // Redirect to LinkedIn OAuth
      window.location.href = authUrl;
    } catch (err) {
      setError(err?.message || 'LinkedIn authentication failed');
      throw err;
    }
  }, []);

  const value = useMemo(() => {
    return {
      user,
      isGuest,
      initializing,
      error,
      pendingGoogleLinkEmail: pendingGoogleLink?.email ?? null,
      isAuthenticated: !!user,
      continueAsGuest,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      linkGoogleWithPassword,
      clearPendingGoogleLink,
      signInWithLinkedIn,
      signOut,
      deleteAccount,
    };
  }, [user, isGuest, initializing, error, pendingGoogleLink, continueAsGuest, signUpWithEmail, signInWithEmail, signInWithGoogle, linkGoogleWithPassword, clearPendingGoogleLink, signInWithLinkedIn, signOut, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
