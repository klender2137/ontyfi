// Dumb feed grid - pure presentation
window.FeedGrid = ({ opportunities, onCardClick, showModal }) => {
  if (!opportunities || opportunities.length === 0) {
    return React.createElement('div', {
      className: 'card',
      style: { textAlign: 'center', padding: '3rem' }
    }, [
      React.createElement('div', {
        key: 'icon',
        style: { fontSize: '3rem', marginBottom: '1rem' }
      }, '📊'),
      React.createElement('h3', {
        key: 'title',
        style: { marginBottom: '1rem' }
      }, 'No Alpha Available'),
      React.createElement('p', {
        key: 'desc',
        style: { color: '#94a3b8', marginBottom: '2rem' }
      }, 'Unable to fetch opportunities. Using cached data.'),
      React.createElement('button', {
        key: 'refresh',
        className: 'primary-button',
        onClick: () => window.location.reload()
      }, 'Refresh Feed')
    ]);
  }

  return React.createElement('div', null, [
    React.createElement('div', {
      key: 'meta',
      style: { marginBottom: '1.5rem', color: '#94a3b8' }
    }, `${opportunities.length} opportunities • Auto-refresh every 5min`),
    
    React.createElement('div', {
      key: 'grid',
      style: { 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
        gap: '1.5rem' 
      }
    }, (showModal ? [] : opportunities).map(opportunity =>
      React.createElement(window.OpportunityCard, {
        key: opportunity.id,
        opportunity,
        onClick: onCardClick
      })
    ))
  ]);
};