import { Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import './styles/touchStyles.css'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingSkeleton from './components/LoadingSkeleton'
import AuthScreen from './components/AuthScreen'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Home from './components/Home'
import TreeMap from './components/TreeMap'
import MyInsightsScreen from './components/MyInsightsScreen'
import LinkedInCallback from './components/LinkedInCallback'
import FinanceFitQuestionnaire from './components/FinanceFitQuestionnaire'
import FinanceArchetypeScreen from './components/FinanceArchetypeScreen'

// Android Back Button Handler
function useAndroidBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isGuest } = useAuth();

  useEffect(() => {
    // Only handle back button when authenticated (not on auth screen)
    if (!isAuthenticated && !isGuest) return;

    const handlePopState = (e) => {
      // Prevent default back navigation
      e.preventDefault();
      
      // Custom back navigation logic
      const currentPath = location.pathname;
      
      // Navigate based on current route
      if (currentPath === '/home' || currentPath === '/') {
        // Already at home, let the browser handle it (or show exit confirmation)
        return;
      } else if (currentPath === '/tree' || currentPath === '/my-insights') {
        // Navigate back to home
        navigate('/home');
      } else {
        // Default: go to home
        navigate('/home');
      }
    };

    // Listen for popstate events (back button)
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate, location, isAuthenticated, isGuest]);
}

// Edge swipe detector for Android gesture navigation
function useEdgeSwipeDetector() {
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    const edgeThreshold = 20; // pixels from edge

    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      // Detect edge swipe from left (Android back gesture)
      if (touchStartX < edgeThreshold) {
        // This is an edge swipe - let the browser handle it
        return;
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);
}

function AppRoutes() {
  const { initializing, isAuthenticated, isGuest } = useAuth();

  // Initialize Android back gesture handling
  useAndroidBackHandler();
  useEdgeSwipeDetector();

  if (initializing) {
    return <LoadingSkeleton />;
  }

  if (!isAuthenticated && !isGuest) {
    return <AuthScreen />;
  }

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Routes>
        <Route path="/" element={
          <ErrorBoundary>
            <MyInsightsScreen />
          </ErrorBoundary>
        } />
        <Route path="/home" element={<Home />} />
        <Route path="/tree" element={
          <ErrorBoundary>
            <TreeMap />
          </ErrorBoundary>
        } />
        <Route path="/my-insights" element={
          <ErrorBoundary>
            <MyInsightsScreen />
          </ErrorBoundary>
        } />
        <Route path="/auth/callback" element={<LinkedInCallback />} />
        <Route path="/finance-questionnaire" element={
          <ErrorBoundary>
            <FinanceFitQuestionnaire />
          </ErrorBoundary>
        } />
        <Route path="/archetype-diagnostic" element={
          <ErrorBoundary>
            <FinanceArchetypeScreen />
          </ErrorBoundary>
        } />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Router>
          <div 
            className="safe-area-top safe-area-bottom"
            style={{ 
              background: '#0f172a', 
              color: '#f7f9ff',
              minHeight: '100vh',
              minHeight: '100dvh', // Dynamic viewport height for mobile
              fontFamily: 'system-ui, -apple-system, sans-serif',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'pan-y'
            }}
          >
            <AppRoutes />
          </div>
        </Router>
      </ErrorBoundary>
    </AuthProvider>
  )
}

export default App