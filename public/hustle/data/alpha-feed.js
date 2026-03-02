// Alpha feed fetcher - isolated, timeout-protected
window.AlphaFeedFetcher = (() => {
  const TIMEOUT = 3000;
  let controller = null;

  const mockData = [
    {
      id: 'mock1',
      title: 'DeFi Yield Farming Opportunity',
      description: 'High APY staking pool discovered on emerging protocol',
      source: 'DeFiPulse',
      alphaScore: 8.5,
      tags: ['defi', 'yield', 'staking'],
      timestamp: Date.now(),
      url: '#'
    }
  ];

  return {
    fetch: async () => {
      try {
        controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

        // Try real API first
        try {
          const response = await fetch('/api/alpha-feed', {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            return { success: true, data: data.items || [] };
          }
        } catch (apiError) {
          console.warn('Alpha API failed, using mock data:', apiError.message);
        }

        // Fallback to mock data
        return { success: true, data: mockData };
      } catch (error) {
        return { success: false, error: error.message, data: mockData };
      }
    },
    abort: () => {
      if (controller) controller.abort();
    }
  };
})();