// Dumb modal component - pure presentation
window.OpportunityModal = ({ isOpen, opportunity, onClose, onAction }) => {
  if (!isOpen || !opportunity) return null;

  const getSourceColor = (source) => {
    const colors = {
      'DeFiPulse': '#10b981',
      'CoinGecko': '#f59e0b', 
      'Twitter': '#3b82f6',
      'Cache': '#6b7280'
    };
    return colors[source] || '#6b7280';
  };

  const handleAction = () => {
    if (opportunity.url && opportunity.url !== '#') {
      window.open(opportunity.url, '_blank');
    }
    onAction?.();
  };

  return React.createElement('div', {
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    onClick: onClose
  }, 
    React.createElement('div', {
      style: {
        background: '#0f172a',
        border: '1px solid rgba(148, 163, 184, 0.3)',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      },
      onClick: (e) => e.stopPropagation()
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
            fontSize: '0.75rem'
          }
        }, opportunity.source),
        React.createElement('button', {
          key: 'close',
          onClick: onClose,
          style: {
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.5rem',
            cursor: 'pointer'
          }
        }, '×')
      ]),
      React.createElement('h3', {
        key: 'title',
        style: { marginBottom: '1rem', color: '#f7f9ff' }
      }, opportunity.title),
      React.createElement('p', {
        key: 'desc',
        style: { color: '#94a3b8', lineHeight: '1.6', marginBottom: '2rem' }
      }, opportunity.description),
      React.createElement('div', {
        key: 'actions',
        style: { display: 'flex', gap: '1rem' }
      }, [
        React.createElement('button', {
          key: 'action',
          className: 'primary-button',
          onClick: handleAction,
          disabled: !opportunity.url || opportunity.url === '#'
        }, 'Take Action'),
        React.createElement('button', {
          key: 'close-btn',
          className: 'secondary-button',
          onClick: onClose
        }, 'Close')
      ])
    ])
  );
};