import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from './firebase';

// Utility functions from main MyHustle.js
const formatTimeAgo = (dateLike) => {
  if (!dateLike) return '';
  let ts = null;
  try {
    if (typeof dateLike === 'number') ts = dateLike;
    else if (typeof dateLike.toDate === 'function') ts = dateLike.toDate().getTime();
    else if (dateLike instanceof Date) ts = dateLike.getTime();
    else ts = new Date(dateLike).getTime();
  } catch { return ''; }
  if (!Number.isFinite(ts)) return '';
  const diffMs = Math.max(0, Date.now() - ts);
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
};

const shortText = (text, max = 160) => {
  const t = (text || '').toString().replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

// Alpha score calculation with 20% daily decay
function calculateAlphaScore(timestamp) {
  const now = Date.now();
  const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(100 * Math.pow(0.8, ageInDays)));
}

// Main scraper data hook - transferred from main MyHustle.js
export const useHustlesV2Data = ({ categories, enabled = true } = {}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    const categoryList = Array.isArray(categories)
      ? categories.filter(Boolean)
      : categories
        ? [categories]
        : null;

    let didFallbackToClientFilter = false;
    let unsubscribe = null;

    const trySubscribe = (withServerFilter) => {
      try {
        if (!window.firebase || !window.firebase.firestore) {
          console.error('[MyHustle] Firebase not available, retrying...');
          setTimeout(() => trySubscribe(withServerFilter), 1000);
          return;
        }

        const db = window.firebase.firestore();
        let query = db.collection('hustles_v2').orderBy('date_added', 'desc');

        if (withServerFilter && categoryList && categoryList.length > 0) {
          if (categoryList.length === 1) {
            query = query.where('category', '==', categoryList[0]);
          } else {
            query = query.where('category', 'in', categoryList.slice(0, 10));
          }
        }

        // Add timeout to prevent infinite loading
        const loadingTimeout = setTimeout(() => {
          if (loading) {
            console.warn('[MyHustle] Loading timeout - showing fallback');
            setLoading(false);
            setError('Loading timeout. Please refresh the page.');
          }
        }, 10000); // 10 second timeout

        unsubscribe = query.onSnapshot(
          (snapshot) => {
            let next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

            if (!withServerFilter && categoryList && categoryList.length > 0) {
              didFallbackToClientFilter = true;
              next = next.filter((d) => categoryList.includes(d?.category || d?.type));
            }

            // Add alpha scores and format data
            next = next.map(item => ({
              ...item,
              alphaScore: calculateAlphaScore(item.date_added?.toDate?.()?.getTime() || Date.now()),
              formattedTimeAgo: formatTimeAgo(item.date_added || item.timestamp || item.addedAt),
              shortDescription: shortText(item?.short_description || item?.description || item?.summary || '')
            }));

            setItems(next);
            setLoading(false);
            clearTimeout(loadingTimeout); // Clear timeout on success
            setError(
              didFallbackToClientFilter
                ? 'Using client-side filtering (Firestore index not available).'
                : null
            );
          },
          (err) => {
            if (withServerFilter) {
              console.warn('[MyHustle] Category query failed, retrying without server filter:', err);
              trySubscribe(false);
              return;
            }
            console.error('[MyHustle] Subscription failed:', err);
            clearTimeout(loadingTimeout); // Clear timeout on error
            setItems([]);
            setLoading(false);
            setError(err?.message || 'Failed to load hustles_v2');
          }
        );
      } catch (e) {
        console.error('[MyHustle] Firebase error:', e);
        // Fallback to mock data
        const mockData = [
          {
            id: 'mock-1',
            title: 'Ethereum Staking Rewards',
            category: 'yield',
            short_description: 'Earn passive income by staking ETH on the beacon chain',
            date_added: new window.firebase.firestore.Timestamp(Date.now() / 1000 - 7200, 0),
            source: 'Ethereum Foundation',
            network: 'Ethereum',
            link: 'https://ethereum.org/staking',
            alphaScore: 85,
            formattedTimeAgo: '2h',
            shortDescription: 'Earn passive income by staking ETH on the beacon chain'
          },
          {
            id: 'mock-2',
            title: 'Arbitrum Airdrop Season 2',
            category: 'airdrop',
            short_description: 'Eligible users can claim ARB tokens from the second airdrop round',
            date_added: new window.firebase.firestore.Timestamp(Date.now() / 1000 - 21600, 0),
            source: 'Arbitrum DAO',
            network: 'Arbitrum',
            link: 'https://arbitrum.foundation/',
            alphaScore: 72,
            formattedTimeAgo: '6h',
            shortDescription: 'Eligible users can claim ARB tokens from the second airdrop round'
          }
        ];
        
        setItems(mockData);
        setLoading(false);
        setError('Using demo data - Firebase connection failed');
      }
    };

    // Start subscription
    trySubscribe(true);

    // Cleanup
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [categories, enabled]);

  return { items, loading, error };
};

// Legacy hook for backward compatibility
export const useHustleData = () => {
  const { items, loading, error } = useHustlesV2Data({ enabled: true });
  
  // Sort by alpha score
  const hustleList = [...items].sort((a, b) => (b.alphaScore || 0) - (a.alphaScore || 0));
  
  return { hustleList, loading, error };
};