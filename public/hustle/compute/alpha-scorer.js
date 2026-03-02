// Pure alpha scoring - deterministic, no side effects
window.AlphaScorer = (() => {
  const scoreFactors = {
    source: { 'DeFiPulse': 1.2, 'CoinGecko': 1.0, 'Twitter': 0.8 },
    recency: (timestamp) => Math.max(0, 1 - (Date.now() - timestamp) / (24 * 60 * 60 * 1000)),
    tags: { 'defi': 1.1, 'yield': 1.2, 'airdrop': 1.3, 'nft': 0.9 }
  };

  return {
    score: (item) => {
      if (!item) return 0;
      
      let score = 5; // base score
      
      // Source multiplier
      score *= scoreFactors.source[item.source] || 1.0;
      
      // Recency factor
      if (item.timestamp) {
        score *= (0.5 + scoreFactors.recency(item.timestamp));
      }
      
      // Tag bonuses
      if (item.tags) {
        const tagBonus = item.tags.reduce((acc, tag) => 
          acc + (scoreFactors.tags[tag.toLowerCase()] || 1.0), 0
        ) / item.tags.length;
        score *= tagBonus;
      }
      
      return Math.min(10, Math.max(0, Math.round(score * 10) / 10));
    },
    
    rank: (items) => {
      return items
        .map(item => ({ ...item, computedScore: this.score(item) }))
        .sort((a, b) => b.computedScore - a.computedScore);
    }
  };
})();