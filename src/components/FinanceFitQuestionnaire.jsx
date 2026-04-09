import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';

/**
 * FinanceFitQuestionnaire Component
 * Protected questionnaire that calculates F_i (Finance Fit Index)
 * Uses LinkedIn OAuth session token for authorization
 */
export default function FinanceFitQuestionnaire() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasCompleted, setHasCompleted] = useState(false);

  // Check if user has already completed the questionnaire
  useEffect(() => {
    async function checkStatus() {
      if (!isAuthenticated || !user) {
        setLoading(false);
        return;
      }

      try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch('/api/questionnaire/status', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.completed && data.fiResult) {
            setHasCompleted(true);
            setResult(data.fiResult);
          }
        }
      } catch (err) {
        console.error('[FinanceFitQuestionnaire] Status check error:', err);
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, [isAuthenticated, user]);

  const questions = [
    {
      id: 'risk_tolerance_1',
      category: 'riskTolerance',
      question: 'How would you react if your investment portfolio lost 20% in a month?',
      options: [
        { value: 5, label: 'Sell everything immediately', score: 5 },
        { value: 10, label: 'Sell some investments', score: 10 },
        { value: 15, label: 'Hold and wait for recovery', score: 15 },
        { value: 20, label: 'Buy more at lower prices', score: 20 }
      ]
    },
    {
      id: 'investment_knowledge_1',
      category: 'investmentKnowledge',
      question: 'How familiar are you with financial markets and investment products?',
      options: [
        { value: 5, label: 'No knowledge', score: 5 },
        { value: 10, label: 'Basic understanding', score: 10 },
        { value: 15, label: 'Good knowledge', score: 15 },
        { value: 20, label: 'Expert level', score: 20 }
      ]
    },
    {
      id: 'financial_stability_1',
      category: 'financialStability',
      question: 'Do you have an emergency fund covering 3-6 months of expenses?',
      options: [
        { value: 5, label: 'No emergency fund', score: 5 },
        { value: 10, label: 'Less than 3 months', score: 10 },
        { value: 15, label: '3-6 months saved', score: 15 },
        { value: 20, label: 'More than 6 months', score: 20 }
      ]
    },
    {
      id: 'time_horizon_1',
      category: 'timeHorizon',
      question: 'How long do you plan to keep your investments?',
      options: [
        { value: 5, label: 'Less than 1 year', score: 5 },
        { value: 10, label: '1-3 years', score: 10 },
        { value: 15, label: '3-7 years', score: 15 },
        { value: 20, label: 'More than 7 years', score: 20 }
      ]
    },
    {
      id: 'investment_style_1',
      category: 'investmentStyle',
      question: 'Which statement best describes your investment approach?',
      options: [
        { value: 5, label: 'Capital preservation is my priority', score: 5 },
        { value: 10, label: 'Some growth, mostly stable income', score: 10 },
        { value: 15, label: 'Balanced growth and income', score: 15 },
        { value: 20, label: 'Maximum growth potential', score: 20 }
      ]
    }
  ];

  const handleAnswer = useCallback((questionId, option) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        value: option.value,
        score: option.score,
        category: questions.find(q => q.id === questionId).category
      }
    }));
  }, [questions]);

  const handleNext = useCallback(() => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  }, [currentStep, questions.length]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      // Transform answers for API
      const formattedAnswers = Object.entries(answers).map(([questionId, data]) => ({
        questionId,
        category: data.category,
        value: data.score
      }));

      // Check if all questions are answered
      if (formattedAnswers.length < questions.length) {
        throw new Error('Please answer all questions before submitting');
      }

      // Get Firebase ID token for authorization
      const idToken = await auth.currentUser.getIdToken();

      // Submit questionnaire
      const response = await fetch('/api/questionnaire/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ answers: formattedAnswers })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit questionnaire');
      }

      const data = await response.json();
      setResult(data.fiResult);
      setHasCompleted(true);

    } catch (err) {
      console.error('[FinanceFitQuestionnaire] Submit error:', err);
      setError(err.message || 'Failed to submit questionnaire');
    } finally {
      setSubmitting(false);
    }
  }, [answers, questions.length]);

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.heading}>Authentication Required</h2>
          <p style={styles.text}>Please sign in with LinkedIn to access the Finance Fit Questionnaire.</p>
          <button onClick={() => navigate('/')} style={styles.button}>
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingSpinner} />
        <p style={styles.text}>Loading...</p>
      </div>
    );
  }

  // Show results if already completed
  if (hasCompleted && result) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.heading}>Your Finance Fit Index (F_i)</h2>

          <div style={styles.scoreContainer}>
            <div style={styles.scoreCircle}>
              <span style={styles.scoreValue}>{result.score}</span>
              <span style={styles.scoreLabel}>/ 100</span>
            </div>
          </div>

          <div style={styles.profileBadge}>
            <span style={styles.profileLabel}>Profile:</span>
            <span style={styles.profileValue}>{result.profile}</span>
          </div>

          <p style={styles.text}>
            Your Finance Fit Index measures your financial knowledge, risk tolerance,
            and investment readiness based on your questionnaire responses.
          </p>

          <div style={styles.buttonGroup}>
            <button onClick={() => navigate('/home')} style={styles.button}>
              Back to Home
            </button>
            <button
              onClick={() => {
                setHasCompleted(false);
                setResult(null);
                setAnswers({});
                setCurrentStep(0);
              }}
              style={styles.secondaryButton}
            >
              Retake Questionnaire
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;
  const hasAnswer = answers[currentQuestion?.id];

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Finance Fit Questionnaire</h2>

        {/* Progress bar */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <span style={styles.progressText}>
            Question {currentStep + 1} of {questions.length}
          </span>
        </div>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        {/* Question */}
        <div style={styles.questionSection}>
          <h3 style={styles.question}>{currentQuestion.question}</h3>

          <div style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => {
              const isSelected = answers[currentQuestion.id]?.value === option.value;
              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                  style={{
                    ...styles.optionButton,
                    ...(isSelected ? styles.optionButtonSelected : {})
                  }}
                >
                  <span style={styles.optionLabel}>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div style={styles.navigation}>
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            style={{
              ...styles.navButton,
              ...(currentStep === 0 ? styles.navButtonDisabled : {})
            }}
          >
            Previous
          </button>

          <button
            onClick={handleNext}
            disabled={!hasAnswer || submitting}
            style={{
              ...styles.navButton,
              ...styles.navButtonPrimary,
              ...((!hasAnswer || submitting) ? styles.navButtonDisabled : {})
            }}
          >
            {submitting ? 'Submitting...' : currentStep === questions.length - 1 ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: '#0f172a',
    color: '#f7f9ff',
  },
  card: {
    width: '100%',
    maxWidth: '600px',
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '16px',
    padding: '2rem',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    margin: '0 0 1.5rem',
    textAlign: 'center',
  },
  text: {
    fontSize: '1rem',
    color: '#94a3b8',
    margin: '0 0 1.5rem',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  loadingSpinner: {
    width: '48px',
    height: '48px',
    border: '4px solid rgba(59, 130, 246, 0.3)',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  progressContainer: {
    marginBottom: '2rem',
  },
  progressBar: {
    height: '8px',
    background: 'rgba(148, 163, 184, 0.2)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  progressFill: {
    height: '100%',
    background: '#3b82f6',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    textAlign: 'center',
  },
  questionSection: {
    marginBottom: '2rem',
  },
  question: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 1.5rem',
    lineHeight: 1.5,
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  optionButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '1rem',
    background: 'rgba(148, 163, 184, 0.1)',
    border: '2px solid transparent',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
  },
  optionButtonSelected: {
    background: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3b82f6',
  },
  optionLabel: {
    fontSize: '1rem',
    color: '#f7f9ff',
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  navButton: {
    flex: 1,
    padding: '0.875rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    border: '1px solid rgba(148, 163, 184, 0.3)',
    borderRadius: '12px',
    background: 'transparent',
    color: '#f7f9ff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  navButtonPrimary: {
    background: '#3b82f6',
    borderColor: '#3b82f6',
  },
  navButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  errorBox: {
    padding: '1rem',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#fecaca',
    marginBottom: '1.5rem',
    textAlign: 'center',
  },
  scoreContainer: {
    display: 'flex',
    justifyContent: 'center',
    margin: '2rem 0',
  },
  scoreCircle: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)',
  },
  scoreValue: {
    fontSize: '3rem',
    fontWeight: 800,
    color: '#ffffff',
  },
  scoreLabel: {
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  profileBadge: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  profileLabel: {
    fontSize: '1rem',
    color: '#94a3b8',
    marginRight: '0.5rem',
  },
  profileValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#3b82f6',
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
  },
  button: {
    padding: '0.875rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    background: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  secondaryButton: {
    padding: '0.875rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};
