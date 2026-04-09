import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import FinanceArchetypeDiagnostic from './Questionaire';

const CACHE_KEY = 'finance_archetype_result';

const FinanceArchetypeScreen = () => {
  const navigate = useNavigate();
  const [hasCompleted, setHasCompleted] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    async function checkCompletionStatus() {
      const auth = getAuth();
      const user = auth.currentUser;
      
      // Check local cache first for quick display
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setLastResult(parsed);
          setHasCompleted(true);
        } catch (e) {
          console.warn('[FinanceArchetypeScreen] Failed to parse cached result');
        }
      }

      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.financeArchetypeResult) {
              setLastResult(data.financeArchetypeResult);
              setHasCompleted(true);
              // Update cache
              localStorage.setItem(CACHE_KEY, JSON.stringify(data.financeArchetypeResult));
            }
          }
        } catch (err) {
          console.error('[FinanceArchetypeScreen] Error checking Firebase status:', err);
        }
      }
      
      setLoading(false);
    }

    checkCompletionStatus();
  }, []);

  const handleTestComplete = async (result) => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    const resultData = {
      topField: result[0],
      allScores: result,
      completedAt: new Date().toISOString(),
    };

    // Save to localStorage for quick access
    localStorage.setItem(CACHE_KEY, JSON.stringify(resultData));

    // Save to Firebase if user is authenticated
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { 
          financeArchetypeResult: resultData,
          financeArchetypeCompleted: true 
        }, { merge: true });
        console.log('[FinanceArchetypeScreen] Results saved to Firebase');
      } catch (err) {
        console.error('[FinanceArchetypeScreen] Error saving to Firebase:', err);
      }
    }

    setHasCompleted(true);
    setLastResult(resultData);
  };

  const handleRetake = () => {
    setHasCompleted(false);
    setShowIntro(false);
  };

  const handleNavigateToTree = () => {
    // Pass the result through navigation state
    navigate('/tree', { 
      state: { 
        archetypeResult: lastResult,
        highlightField: lastResult?.topField?.key 
      }
    });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  // Show results summary if completed
  if (hasCompleted && lastResult && showIntro) {
    const topField = lastResult.topField;
    const fieldData = topField?.fieldData;

    return (
      <div style={styles.container}>
        <div style={styles.resultCard}>
          <h2 style={styles.heading}>Your Finance Archetype</h2>
          
          {fieldData && (
            <div style={{
              ...styles.winnerCard,
              background: fieldData.light || 'rgba(59, 130, 246, 0.15)',
              borderColor: fieldData.color || '#3b82f6',
            }}>
              <div style={styles.icon}>{fieldData.icon}</div>
              <div style={{...styles.archetypeLabel, color: fieldData.color}}>
                YOUR DESTINY FIELD
              </div>
              <div style={{...styles.fieldName, color: fieldData.text || '#f7f9ff'}}>
                {fieldData.label}
              </div>
              <div style={{...styles.archetypeName, color: fieldData.color}}>
                {fieldData.archetype}
              </div>
              <p style={{...styles.description, color: fieldData.text || '#94a3b8'}}>
                {fieldData.desc}
              </p>
            </div>
          )}

          <div style={styles.buttonGroup}>
            <button onClick={handleNavigateToTree} style={styles.primaryButton}>
              Explore in TreeMap →
            </button>
            <button onClick={handleRetake} style={styles.secondaryButton}>
              Retake Test
            </button>
          </div>

          <button onClick={() => navigate('/home')} style={styles.backButton}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Show intro screen before starting test
  if (showIntro && !hasCompleted) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.rhombusIcon}>◈</div>
          <h2 style={styles.heading}>Finance Archetype Diagnostic</h2>
          <p style={styles.text}>
            Discover which field of finance aligns with your natural tendencies.
            Answer 7 interactive questions to reveal your ideal career path.
          </p>
          <div style={styles.features}>
            <div style={styles.feature}>⬡ Speed under pressure</div>
            <div style={styles.feature}>◈ Risk tolerance</div>
            <div style={styles.feature}>◎ Social preferences</div>
          </div>
          <button 
            onClick={() => setShowIntro(false)} 
            style={styles.startButton}
          >
            Start Diagnostic
          </button>
          <button onClick={() => navigate('/home')} style={styles.backButton}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Show the actual questionnaire
  return (
    <div style={styles.questionnaireContainer}>
      <FinanceArchetypeDiagnostic 
        onComplete={handleTestComplete}
        projectColors={projectColors}
      />
      {hasCompleted && (
        <div style={styles.completionOverlay}>
          <div style={styles.completionCard}>
            <h3 style={styles.completionTitle}>Test Complete!</h3>
            <p style={styles.completionText}>Your results have been saved.</p>
            <div style={styles.buttonGroup}>
              <button onClick={handleNavigateToTree} style={styles.primaryButton}>
                View in TreeMap
              </button>
              <button onClick={() => navigate('/home')} style={styles.secondaryButton}>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Project color palette matching existing design
const projectColors = {
  background: '#0f172a',
  backgroundSecondary: 'rgba(15, 23, 42, 0.8)',
  backgroundTertiary: 'rgba(148, 163, 184, 0.1)',
  textPrimary: '#f7f9ff',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  borderPrimary: 'rgba(148, 163, 184, 0.3)',
  borderSecondary: 'rgba(148, 163, 184, 0.2)',
  borderTertiary: 'rgba(148, 163, 184, 0.1)',
  accent: '#3b82f6',
  accentLight: 'rgba(59, 130, 246, 0.15)',
  success: '#10b981',
  warning: '#eab308',
  error: '#ef4444',
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: projectColors.background,
    color: projectColors.textPrimary,
  },
  questionnaireContainer: {
    minHeight: '100vh',
    background: projectColors.background,
    color: projectColors.textPrimary,
    position: 'relative',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: `4px solid ${projectColors.borderSecondary}`,
    borderTop: `4px solid ${projectColors.accent}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: projectColors.textSecondary,
    fontSize: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '560px',
    background: projectColors.backgroundSecondary,
    border: `1px solid ${projectColors.borderSecondary}`,
    borderRadius: '16px',
    padding: '2.5rem',
    textAlign: 'center',
  },
  resultCard: {
    width: '100%',
    maxWidth: '600px',
    background: projectColors.backgroundSecondary,
    border: `1px solid ${projectColors.borderSecondary}`,
    borderRadius: '16px',
    padding: '2rem',
  },
  rhombusIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
    color: projectColors.accent,
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    margin: '0 0 1rem',
    color: projectColors.textPrimary,
  },
  text: {
    fontSize: '1rem',
    color: projectColors.textSecondary,
    margin: '0 0 1.5rem',
    lineHeight: 1.6,
  },
  features: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '0.75rem',
    marginBottom: '2rem',
  },
  feature: {
    padding: '0.5rem 1rem',
    background: projectColors.backgroundTertiary,
    borderRadius: '20px',
    fontSize: '0.875rem',
    color: projectColors.textSecondary,
  },
  winnerCard: {
    borderRadius: '16px',
    padding: '2rem',
    textAlign: 'center',
    marginBottom: '1.5rem',
    border: '0.5px solid',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '0.5rem',
  },
  archetypeLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
  },
  fieldName: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  archetypeName: {
    fontSize: '1rem',
    fontWeight: 500,
    marginBottom: '1rem',
  },
  description: {
    fontSize: '0.9rem',
    lineHeight: 1.6,
    margin: 0,
    opacity: 0.9,
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
  },
  startButton: {
    width: '100%',
    padding: '1rem 1.5rem',
    fontSize: '1.1rem',
    fontWeight: 600,
    background: projectColors.accent,
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '1rem',
  },
  primaryButton: {
    flex: 1,
    padding: '0.875rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    background: projectColors.accent,
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  secondaryButton: {
    flex: 1,
    padding: '0.875rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    background: 'transparent',
    color: projectColors.textSecondary,
    border: `1px solid ${projectColors.borderPrimary}`,
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  backButton: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '0.9rem',
    background: 'transparent',
    color: projectColors.textTertiary,
    border: 'none',
    cursor: 'pointer',
    transition: 'color 0.2s ease',
  },
  completionOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  completionCard: {
    background: projectColors.backgroundSecondary,
    border: `1px solid ${projectColors.borderSecondary}`,
    borderRadius: '16px',
    padding: '2rem',
    textAlign: 'center',
    maxWidth: '400px',
  },
  completionTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: projectColors.textPrimary,
    marginBottom: '0.5rem',
  },
  completionText: {
    fontSize: '1rem',
    color: projectColors.textSecondary,
    marginBottom: '1.5rem',
  },
};

export default FinanceArchetypeScreen;
