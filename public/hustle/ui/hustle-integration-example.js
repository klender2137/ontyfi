// Frontend Integration Example for My Hustle Services
// This file shows how to integrate the hustle feed into your React components

// Example 1: Fetch and display hustle feed
async function fetchHustleFeed() {
  try {
    const response = await fetch('/api/hustle/feed?limit=20');
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
  } catch (error) {
    console.error('Failed to fetch hustle feed:', error);
    return [];
  }
}

// Example 2: Trigger data update
async function updateHustleData() {
  try {
    const response = await fetch('/api/hustle/update', {
      method: 'POST'
    });
    const data = await response.json();
    
    if (data.success) {
      console.log('Update successful:', data.data);
      return data.data;
    }
  } catch (error) {
    console.error('Failed to update hustle data:', error);
  }
}

// Example 3: Get statistics
async function getHustleStats() {
  try {
    const response = await fetch('/api/hustle/stats');
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return null;
  }
}

// Example 4: React Component
function HustleFeedComponent() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('all');

  React.useEffect(() => {
    loadFeed();
  }, [filter]);

  async function loadFeed() {
    setLoading(true);
    const url = filter === 'all' 
      ? '/api/hustle/feed?limit=50'
      : `/api/hustle/feed?type=${filter}&limit=50`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      setItems(data.data);
    }
    setLoading(false);
  }

  async function handleUpdate() {
    setLoading(true);
    await updateHustleData();
    await loadFeed();
  }

  return (
    <div className="hustle-feed">
      <div className="controls">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="yield">Yields</option>
          <option value="airdrop">Airdrops</option>
          <option value="article">Articles</option>
        </select>
        <button onClick={handleUpdate}>Update Data</button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="feed-items">
          {items.map(item => (
            <div key={item.id} className={`feed-item ${item.type}`}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              {item.type === 'yield' && (
                <div className="yield-info">
                  <span>APY: {item.apy?.toFixed(2)}%</span>
                  <span>TVL: ${item.tvl?.toLocaleString()}</span>
                </div>
              )}
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                Learn More →
              </a>
              <div className="meta">
                <span className="source">{item.source}</span>
                <span className="timestamp">
                  {new Date(item.timestamp?.seconds * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Example 5: Stats Dashboard Component
function HustleStatsComponent() {
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const data = await getHustleStats();
    setStats(data);
  }

  if (!stats) return <div>Loading stats...</div>;

  return (
    <div className="hustle-stats">
      <h2>Hustle Feed Statistics</h2>
      <div className="stat-card">
        <h3>Total Items</h3>
        <p>{stats.totalItems}</p>
      </div>
      <div className="stat-card">
        <h3>By Type</h3>
        <ul>
          {Object.entries(stats.byType).map(([type, count]) => (
            <li key={type}>{type}: {count}</li>
          ))}
        </ul>
      </div>
      <div className="stat-card">
        <h3>By Source</h3>
        <ul>
          {Object.entries(stats.bySource).map(([source, count]) => (
            <li key={source}>{source}: {count}</li>
          ))}
        </ul>
      </div>
      <div className="stat-card">
        <h3>Last Update</h3>
        <p>{new Date(stats.latestUpdate?.seconds * 1000).toLocaleString()}</p>
      </div>
    </div>
  );
}

// Example CSS
const exampleCSS = `
.hustle-feed {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.feed-items {
  display: grid;
  gap: 20px;
}

.feed-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
}

.feed-item.yield {
  border-left: 4px solid #4CAF50;
}

.feed-item.airdrop {
  border-left: 4px solid #2196F3;
}

.feed-item.article {
  border-left: 4px solid #FF9800;
}

.yield-info {
  display: flex;
  gap: 20px;
  margin: 10px 0;
  font-weight: bold;
}

.meta {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 0.9em;
  color: #666;
}

.hustle-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  padding: 20px;
}

.stat-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
}
`;

export { 
  fetchHustleFeed, 
  updateHustleData, 
  getHustleStats,
  HustleFeedComponent,
  HustleStatsComponent 
};
