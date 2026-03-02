// Alpha Service - Real-time data fetching and normalization
export const alphaService = {
  // Calculate alpha score with 20% daily decay
  calculateAlphaScore: (timestamp, baseScore = 100) => {
    const now = Date.now()
    const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.round(baseScore * Math.pow(0.8, ageInDays)))
  },

  // Fetch DeFiLlama airdrops
  fetchDeFiLlamaData: async () => {
    try {
      const response = await fetch('https://api.llama.fi/airdrops')
      const data = await response.json()
      
      return data.slice(0, 5).map(item => ({
        id: `defi-${item.id || Math.random()}`,
        title: item.name || 'DeFi Protocol Airdrop',
        description: `${item.name} protocol without token - potential airdrop opportunity`,
        source: 'DeFiLlama',
        timestamp: Date.now() - Math.random() * 86400000, // Random within 24h
        alphaScore: this.calculateAlphaScore(Date.now(), 100),
        tags: ['DeFi', 'Airdrop', 'Protocol'],
        url: item.url || '#'
      }))
    } catch (error) {
      console.error('DeFiLlama fetch failed:', error)
      return []
    }
  },

  // Fetch crypto news
  fetchCryptoNews: async () => {
    try {
      const response = await fetch('https://free-crypto-news.vercel.app/api/news')
      const data = await response.json()
      
      return data.slice(0, 5).map(item => ({
        id: `news-${item.id || Math.random()}`,
        title: item.title?.substring(0, 80) || 'Crypto News Update',
        description: (item.description || item.summary || '').substring(0, 150),
        source: 'CryptoPanic',
        timestamp: new Date(item.published_at || item.created_at).getTime(),
        alphaScore: this.calculateAlphaScore(new Date(item.published_at || item.created_at).getTime(), 60),
        tags: ['News', 'Market', 'Alpha'],
        url: item.url || '#'
      }))
    } catch (error) {
      console.error('CryptoPanic fetch failed:', error)
      return []
    }
  },

  // Fetch Bankless RSS
  fetchBanklessData: async () => {
    try {
      const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.bankless.com/rss')
      const data = await response.json()
      
      return data.items.slice(0, 5).map(item => ({
        id: `bankless-${item.guid || Math.random()}`,
        title: item.title?.substring(0, 80) || 'Bankless Article',
        description: item.description?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
        source: 'Bankless',
        timestamp: new Date(item.pubDate).getTime(),
        alphaScore: this.calculateAlphaScore(new Date(item.pubDate).getTime(), 80),
        tags: ['Education', 'DeFi', 'Strategy'],
        url: item.link || '#'
      }))
    } catch (error) {
      console.error('Bankless fetch failed:', error)
      return []
    }
  },

  // Get all latest hustles
  getLatestHustles: async () => {
    try {
      const [defiData, newsData, banklessData] = await Promise.all([
        alphaService.fetchDeFiLlamaData(),
        alphaService.fetchCryptoNews(),
        alphaService.fetchBanklessData()
      ])

      const allHustles = [...defiData, ...newsData, ...banklessData]
      
      // Sort by alpha score descending
      return allHustles.sort((a, b) => b.alphaScore - a.alphaScore)
    } catch (error) {
      console.error('Failed to fetch hustles:', error)
      return []
    }
  },

  // Sanitize content to prevent navigation leaks
  sanitizeContent: (content) => {
    return content
      .replace(/<a[^>]*>/g, '<span>')
      .replace(/<\/a>/g, '</span>')
      .replace(/href="[^"]*"/g, '')
      .replace(/onclick="[^"]*"/g, '')
  }
}