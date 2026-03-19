import { useState, useEffect } from 'react';

export const useInsightsV1Latest = ({ limit = 6 } = {}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!window.firebase || !window.firebase.firestore) {
      console.error('[useInsightsV1Latest] Firebase not available');
      setLoading(false);
      setError('Firebase not available');
      return;
    }

    const db = window.firebase.firestore();
    const query = db
      .collection('insights_v1')
      .orderBy('timestamp', 'desc')
      .limit(limit);

    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[useInsightsV1Latest] Loading timeout');
        setLoading(false);
        setError('Loading timeout. Please refresh.');
      }
    }, 10000);

    const unsubscribe = query.onSnapshot(
      (snapshot) => {
        const latest = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setItems(latest);
        setLoading(false);
        clearTimeout(loadingTimeout);
        setError(null);
      },
      (err) => {
        console.error('[useInsightsV1Latest] Subscription failed:', err);
        clearTimeout(loadingTimeout);
        setItems([]);
        setLoading(false);
        setError(err?.message || 'Failed to load insights_v1');
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, [limit]);

  return { items, loading, error };
};
