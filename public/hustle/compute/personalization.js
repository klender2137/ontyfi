// Pure personalization - deterministic user preferences
window.PersonalizationEngine = (() => {
  const getUserPrefs = () => {
    try {
      const prefs = localStorage.getItem('user_prefs');
      return prefs ? JSON.parse(prefs) : {
        preferredSources: ['DeFiPulse', 'CoinGecko'],
        interestedTags: ['defi', 'yield', 'airdrop'],
        riskTolerance: 'medium'
      };
    } catch {
      return {
        preferredSources: ['DeFiPulse'],
        interestedTags: ['defi'],
        riskTolerance: 'low'
      };
    }
  };

  return {
    personalize: (items) => {
      const prefs = getUserPrefs();
      
      return items.map(item => {
        let personalScore = item.alphaScore || 5;
        let matchingTags = [];
        
        // Source preference boost
        if (prefs.preferredSources.includes(item.source)) {
          personalScore += 1;
        }
        
        // Tag matching
        if (item.tags && prefs.interestedTags) {
          matchingTags = item.tags.filter(tag => 
            prefs.interestedTags.includes(tag.toLowerCase())
          );
          personalScore += matchingTags.length * 0.5;
        }
        
        // Risk adjustment
        if (prefs.riskTolerance === 'low' && personalScore > 8) {
          personalScore -= 1;
        } else if (prefs.riskTolerance === 'high' && personalScore < 6) {
          personalScore += 1;
        }
        
        return {
          ...item,
          personalScore: Math.min(10, Math.max(0, personalScore)),
          matchingTags
        };
      }).sort((a, b) => b.personalScore - a.personalScore);
    },
    
    getPrefs: getUserPrefs,
    
    updatePrefs: (newPrefs) => {
      try {
        localStorage.setItem('user_prefs', JSON.stringify(newPrefs));
      } catch (error) {
        console.warn('Prefs save failed:', error.message);
      }
    }
  };
})();