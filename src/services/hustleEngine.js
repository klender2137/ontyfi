import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Alpha score calculation with 20% daily decay
function calculateAlphaScore(timestamp) {
  const now = Date.now();
  const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(100 * Math.pow(0.8, ageInDays)));
}

export const useHustleData = () => {
  const [hustleList, setHustleList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'global_hustles'), orderBy('addedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let hustles = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          alphaScore: calculateAlphaScore(data.addedAt.toDate().getTime())
        };
      });
      hustles = hustles.sort((a, b) => b.alphaScore - a.alphaScore);
      setHustleList(hustles);
      setLoading(false);
    }, (error) => {
      setError(error.message);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { hustleList, loading, error };
};