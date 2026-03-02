// LevelUpScreen.js - Education component with error boundary
function LevelUpScreen({ onGoHome, onGoToTree }) {
  // Ensure React is available
  if (!window.React) {
    console.error('React not available in LevelUpScreen');
    return React.createElement('div', {
      className: 'screen',
      style: { padding: '2rem', textAlign: 'center' }
    }, 'React not loaded');
  }
  
  const { useState } = React;
  
  const [courses, setCourses] = useState([
    { id: 1, title: 'DeFi Fundamentals', progress: 100, level: 'Beginner', duration: '2h' },
    { id: 2, title: 'Yield Farming Strategies', progress: 60, level: 'Intermediate', duration: '3h' },
    { id: 3, title: 'Advanced MEV Protection', progress: 0, level: 'Advanced', duration: '4h' }
  ]);

  const [achievements, setAchievements] = useState([
    { id: 1, title: 'First LP Position', earned: true, icon: '🏆' },
    { id: 2, title: 'Yield Farmer', earned: true, icon: '🌾' },
    { id: 3, title: 'MEV Survivor', earned: false, icon: '🛡️' },
    { id: 4, title: 'Protocol Explorer', earned: false, icon: '🔍' }
  ]);

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Level Up - Learn & Grow</h2>
        <div>
          <button className="secondary-button" onClick={onGoHome} style={{ marginRight: '1rem' }}>
            ← Home
          </button>
          <button className="secondary-button" onClick={onGoToTree}>
            🌳 Tree
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div>
          <div className="card">
            <h3>Learning Path</h3>
            {courses.map(course => (
              <div key={course.id} style={{ 
                padding: '1rem',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                marginBottom: '1rem',
                background: course.progress === 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>{course.title}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="tag-pill">{course.level}</span>
                    <span className="tag-pill">{course.duration}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      background: 'rgba(148, 163, 184, 0.3)', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${course.progress}%`, 
                        height: '100%', 
                        background: course.progress === 100 ? '#10b981' : '#3b82f6',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{course.progress}%</span>
                  <button 
                    className={course.progress === 100 ? 'secondary-button' : 'primary-button'}
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    {course.progress === 100 ? 'Review' : course.progress > 0 ? 'Continue' : 'Start'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Error Boundary for LevelUp
class LevelUpErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('LevelUp Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        className: 'screen',
        style: { padding: '2rem', textAlign: 'center' }
      }, [
        React.createElement('h2', { key: 'title' }, 'Level Up - Error'),
        React.createElement('p', { key: 'desc' }, 'Something went wrong. Please refresh the page.'),
        React.createElement('button', {
          key: 'btn',
          className: 'primary-button',
          onClick: () => window.location.reload()
        }, 'Reload')
      ]);
    }
    return this.props.children;
  }
}

// Wrapped component with error boundary
function SafeLevelUpScreen(props) {
  return React.createElement(LevelUpErrorBoundary, null,
    React.createElement(LevelUpScreen, props)
  );
}

// Register to window with error handling
try {
  if (typeof window !== 'undefined' && window.React) {
    window.LevelUpScreen = SafeLevelUpScreen;
    console.log('LevelUpScreen registered successfully');
  } else {
    console.error('React not available for LevelUpScreen');
  }
} catch (error) {
  console.error('Failed to register LevelUpScreen:', error);
}