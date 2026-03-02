// Dumb opportunity card - pure presentation
window.OpportunityCard = ({ opportunity, onClick }) => {
  const getSourceColor = (source) => {
    const colors = {
      'DeFiPulse': '#10b981',
      'CoinGecko': '#f59e0b',
      'Twitter': '#3b82f6'
    };
    return colors[source] || '#6b7280';
  };

  const getAlphaColor = (score) => {
    if (score >= 8) return '#ef4444';
    if (score >= 6) return '#f59e0b';
    return '#10b981';
  };

  return React.createElement('div', {
    className: 'card hustle-card',
    style: { cursor: 'pointer' },
    onClick: () => onClick?.(opportunity)
  }, [
    React.createElement('div', {
      key: 'header',
      style: { display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }
    }, [
      React.createElement('span', {
        key: 'source',
        style: {
          background: getSourceColor(opportunity.source),
          color: 'white',
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: '600'
        }
      }, opportunity.source),
      React.createElement('span', {
        key: 'score',
        style: {
          background: getAlphaColor(opportunity.alphaScore),
          color: 'white',
          padding: '0.25rem 0.5rem',
          borderRadius: '8px',
          fontSize: '0.7rem',
          fontWeight: '600'
        }
      }, `${opportunity.alphaScore}α`)
    ]),
    React.createElement('h3', {
      key: 'title',
      style: { marginBottom: '0.75rem', fontSize: '1.1rem' }
    }, opportunity.title),
    React.createElement('p', {
      key: 'desc',
      style: { color: '#94a3b8', marginBottom: '1rem', lineHeight: '1.5' }
    }, opportunity.description),
    React.createElement('div', {
      key: 'footer',
      style: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        fontSize: '0.85rem',
        color: '#94a3b8'
      }
    }, [
      React.createElement('span', { key: 'time' }, 
        new Date(opportunity.timestamp).toLocaleTimeString()
      ),
      React.createElement('span', { key: 'cta' }, 'Click to read →')
    ])
  ]);
};