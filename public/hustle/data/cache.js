// Local cache - instant data, no network calls
window.HustleCache = (() => {
  const CACHE_KEY = 'hustle_cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const defaultData = [
    {
      id: 'cache1',
      title: 'Cached Alpha Opportunity',
      description: 'Previously discovered high-yield opportunity (cached)',
      source: 'Cache',
      alphaScore: 7.2,
      tags: ['cached', 'defi'],
      timestamp: Date.now() - 60000,
      url: '#'
    }
  ];

  return {
    get: () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return defaultData;
        
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_TTL) return defaultData;
        
        return data.length > 0 ? data : defaultData;
      } catch {
        return defaultData;
      }
    },
    
    set: (data) => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: Array.isArray(data) ? data : [],
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn('Cache write failed:', error.message);
      }
    },
    
    clear: () => {
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {}
    }
  };
})();