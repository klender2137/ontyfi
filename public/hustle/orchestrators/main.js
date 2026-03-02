// Main orchestrator - loaded last, coordinates everything
window.HustleOrchestrator = (() => {
  let isInitialized = false;
  
  const LOAD_TIMEOUT = 2000;
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  let refreshTimer = null;

  const loadFreshData = async () => {
    try {
      // Mark as loading
      window.HustleReadiness?.set('feed', false);
      
      // Fetch with timeout protection
      const result = await Promise.race([
        window.AlphaFeedFetcher?.fetch(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), LOAD_TIMEOUT)
        )
      ]);
      
      if (result?.success && result.data) {
        // Process through compute pipeline
        let processedData = result.data;
        
        if (window.AlphaScorer) {
          processedData = processedData.map(item => ({
            ...item,
            alphaScore: window.AlphaScorer.score(item)
          }));
        }
        
        if (window.PersonalizationEngine) {
          processedData = window.PersonalizationEngine.personalize(processedData);
        }
        
        // Update state and cache
        window.HustleFeedState?.set(processedData);
        window.HustleCache?.set(processedData);
        window.HustleReadiness?.set('feed', true);
        
        console.log('✅ Fresh data loaded:', processedData.length, 'items');
      } else {
        throw new Error('API failed');
      }
    } catch (error) {
      console.warn('⚠️ Fresh data failed, keeping cached:', error.message);
      window.HustleReadiness?.set('feed', true);
    }
  };

  const startAutoRefresh = () => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(loadFreshData, REFRESH_INTERVAL);
  };

  const stopAutoRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  return {
    init: async () => {
      if (isInitialized) return;
      isInitialized = true;
      
      console.log('🚀 Hustle orchestrator initializing...');
      
      // 1. Load cached data immediately (no network)
      const cachedData = window.HustleCache?.get() || [];
      if (cachedData.length > 0) {
        let processedCache = cachedData;
        
        if (window.PersonalizationEngine) {
          processedCache = window.PersonalizationEngine.personalize(cachedData);
        }
        
        window.HustleFeedState?.set(processedCache);
        window.HustleReadiness?.set('feed', true);
        console.log('⚡ Cached data loaded instantly:', processedCache.length, 'items');
      }
      
      // 2. Start fresh data fetch (async, non-blocking)
      setTimeout(loadFreshData, 100);
      
      // 3. Start auto-refresh
      startAutoRefresh();
      
      // 4. Mark orchestrator ready
      window.HustleReadiness?.set('orchestrator', true);
    },
    
    refresh: loadFreshData,
    
    destroy: () => {
      stopAutoRefresh();
      window.HustleReadiness?.set('orchestrator', false);
      window.HustleReadiness?.set('feed', false);
      isInitialized = false;
    }
  };
})();