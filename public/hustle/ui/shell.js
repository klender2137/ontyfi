// Static shell - renders instantly, no dependencies
window.HustleShell = ({ onGoHome, onGoToTree }) => {
  return React.createElement('div', { className: 'screen' }, [
    React.createElement('div', {
      key: 'header',
      style: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }
    }, [
      React.createElement('h2', { key: 'title' }, 'My Hustle'),
      React.createElement('div', { key: 'nav' }, [
        React.createElement('button', {
          key: 'home',
          className: 'secondary-button',
          onClick: onGoHome,
          style: { marginRight: '1rem' }
        }, '← Home'),
        React.createElement('button', {
          key: 'tree',
          className: 'secondary-button',
          onClick: onGoToTree
        }, '🌳 Tree')
      ])
    ]),
    React.createElement('div', {
      key: 'loading',
      className: 'card',
      style: { textAlign: 'center', padding: '3rem' }
    }, [
      React.createElement('div', {
        key: 'icon',
        style: { fontSize: '3rem', marginBottom: '1rem' }
      }, '⚡'),
      React.createElement('h3', {
        key: 'title',
        style: { marginBottom: '1rem' }
      }, 'Loading Alpha Feed...'),
      React.createElement('p', {
        key: 'desc',
        style: { color: '#94a3b8' }
      }, 'Fetching real-time opportunities')
    ])
  ]);
};