import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

const alphaFeed = [
  {
    id: 'dune-arbitrum-whales',
    source: "Dune Analytics",
    type: "Data Alpha",
    title: "Whale Activity Surge in Arbitrum DeFi",
    description: "Large wallets accumulating ARB tokens before major protocol updates",
    tags: ["DeFi", "Arbitrum", "Whales"],
    url: "https://dune.com/queries/arbitrum-whale-activity"
  },
  {
    id: 'flipside-solana-nft',
    source: "Flipside Crypto",
    type: "Paid Hustle",
    title: "Solana NFT Market Analysis - $500 Bounty",
    description: "Analyze trading patterns in top Solana NFT collections",
    tags: ["Solana", "NFT", "Analytics"],
    url: "https://flipsidecrypto.xyz/bounties/solana-nft-analysis"
  },
  {
    id: 'dune-layerzero-tracker',
    source: "Dune Analytics",
    type: "Airdrop Tool",
    title: "LayerZero Interaction Tracker",
    description: "Track your cross-chain interactions for potential airdrops",
    tags: ["Airdrop", "LayerZero", "Cross-chain"],
    url: "https://dune.com/queries/layerzero-interactions"
  },
  {
    id: 'flipside-ethereum-l2',
    source: "Flipside Crypto",
    type: "Paid Hustle",
    title: "Ethereum L2 Fee Comparison - $300 Bounty",
    description: "Compare transaction costs across major L2 solutions",
    tags: ["Ethereum", "Layer2", "Fees"],
    url: "https://flipsidecrypto.xyz/bounties/l2-fee-analysis"
  },
  {
    id: 'dune-defi-tvl',
    source: "Dune Analytics",
    type: "Data Alpha",
    title: "DeFi TVL Migration Patterns",
    description: "Capital flows between protocols revealing market sentiment",
    tags: ["DeFi", "TVL", "Analytics"],
    url: "https://dune.com/queries/defi-tvl-migration"
  },
  {
    id: 'flipside-cosmos-growth',
    source: "Flipside Crypto",
    type: "Paid Hustle",
    title: "Cosmos Ecosystem Growth - $400 Bounty",
    description: "Research adoption metrics across Cosmos chains",
    tags: ["Cosmos", "IBC", "Ecosystem"],
    url: "https://flipsidecrypto.xyz/bounties/cosmos-growth"
  }
]

const HustleFeed = () => {
  const navigate = useNavigate()
  const getUserInterests = useAppStore(state => state.getUserInterests)
  const [showAllHustles, setShowAllHustles] = useState(false)

  const personalizedFeed = useMemo(() => {
    const userInterests = getUserInterests()
    
    if (showAllHustles) {
      return alphaFeed.map(opportunity => ({
        ...opportunity,
        relevanceScore: 0,
        matchingTags: []
      }))
    }
    
    if (userInterests.length === 0) return []
    
    return alphaFeed
      .map(opportunity => {
        const matches = opportunity.tags.filter(tag => 
          userInterests.some(interest => 
            interest.toLowerCase().includes(tag.toLowerCase()) ||
            tag.toLowerCase().includes(interest.toLowerCase())
          )
        )
        
        return {
          ...opportunity,
          relevanceScore: matches.length,
          matchingTags: matches
        }
      })
      .filter(opportunity => opportunity.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
  }, [getUserInterests, showAllHustles])

  const handleOpenLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleKeyDown = (event, url) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenLink(url)
    }
  }

  if (personalizedFeed.length === 0 && !showAllHustles) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <h3 style={{ marginBottom: '1rem' }}>No Personalized Alpha Yet</h3>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
          Bookmark articles in the CryptoMap tree to generate your personalized alpha feed.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button 
            onClick={() => navigate('/tree')}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Explore CryptoMap Tree
          </button>
          <button 
            onClick={() => setShowAllHustles(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Show All Hustles
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>My Hustle</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={() => setShowAllHustles(!showAllHustles)}
            style={{ 
              padding: '0.5rem 1rem', 
              background: showAllHustles ? '#10b981' : '#374151', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {showAllHustles ? 'Show Personalized' : 'Show All Hustles'}
          </button>
          <button onClick={() => navigate('/')} style={{ padding: '0.5rem 1rem', background: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            ← Home
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>
        {showAllHustles 
          ? `Showing all ${personalizedFeed.length} recent opportunities from sources`
          : `Found ${personalizedFeed.length} opportunities matching your interests`
        }
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {personalizedFeed.map(opportunity => (
          <div 
            key={opportunity.id}
            role="button"
            tabIndex={0}
            aria-label={`Open ${opportunity.title} from ${opportunity.source}`}
            style={{ 
              padding: '1.5rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleOpenLink(opportunity.url)}
            onKeyDown={(e) => handleKeyDown(e, opportunity.url)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ 
                background: opportunity.source === "Dune Analytics" ? "#3b82f6" : "#10b981",
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                {opportunity.source}
              </span>
              <span style={{ 
                background: opportunity.type === "Data Alpha" ? "#f59e0b" : opportunity.type === "Paid Hustle" ? "#10b981" : "#8b5cf6",
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                {opportunity.type}
              </span>
            </div>
            
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', color: '#f7f9ff' }}>
              {opportunity.title}
            </h3>
            
            <p style={{ color: '#94a3b8', marginBottom: '1rem', lineHeight: '1.5' }}>
              {opportunity.description}
            </p>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {opportunity.tags.map(tag => {
                const isMatching = opportunity.matchingTags.includes(tag)
                return (
                  <span 
                    key={tag}
                    style={{
                      background: isMatching ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                      border: isMatching ? '1px solid #10b981' : '1px solid transparent',
                      color: isMatching ? '#10b981' : '#94a3b8',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem'
                    }}
                  >
                    {tag}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default HustleFeed