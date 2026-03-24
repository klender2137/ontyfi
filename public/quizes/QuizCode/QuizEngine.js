// QuizEngine.js - Interactive Quiz Engine for Article View
if (typeof window !== 'undefined' && window.React) {
  const { useEffect, useMemo, useState, useCallback } = window.React;

  function getCurrentUid() {
    try {
      return window.localStorage.getItem('cryptoExplorer.userId') || null;
    } catch {
      return null;
    }
  }

  function getAttemptKey(uid, quizId) {
    return `cryptoExplorer.quizAttempt.${uid || 'guest'}.${quizId}`;
  }

  function readAttemptState(uid, quizId) {
    try {
      const raw = window.localStorage.getItem(getAttemptKey(uid, quizId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeAttemptState(uid, quizId, state) {
    try {
      window.localStorage.setItem(getAttemptKey(uid, quizId), JSON.stringify(state));
    } catch {}
  }

  function msUntilAllowed(lastAttemptMs, cooldownMs) {
    if (!lastAttemptMs) return 0;
    const nextAllowed = lastAttemptMs + cooldownMs;
    return Math.max(0, nextAllowed - Date.now());
  }

  function formatDuration(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function evaluateQuestion(q, userAnswer) {
    const type = q.type;

    if (type === 'SINGLE_CHOICE') {
      if (!q.options || !Array.isArray(q.options)) return false;
      const correct = q.options.find(o => o && o.isCorrect);
      return !!correct && userAnswer === correct.id;
    }

    if (type === 'MULTI_CHOICE') {
      const ua = Array.isArray(userAnswer) ? userAnswer.slice().sort() : [];
      const correctIds = (q.options || []).filter(o => o && o.isCorrect).map(o => o.id).slice().sort();
      if (ua.length !== correctIds.length) return false;
      return ua.every((id, i) => id === correctIds[i]);
    }

    if (type === 'OPEN_FIELD') {
      const txt = (userAnswer || '').toString().toLowerCase();
      const mustContain = (q.correctLogic?.mustContain || []).map(s => (s || '').toString().toLowerCase()).filter(Boolean);
      if (mustContain.length === 0) return txt.trim().length > 0;
      return mustContain.every(fragment => txt.includes(fragment));
    }

    return false;
  }

  function computeScore(quiz, answers) {
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const totalPoints = Number(quiz?.totalPoints) || questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0) || 100;

    let earned = 0;
    let possible = 0;

    for (const q of questions) {
      const pts = Number(q.points) || 0;
      possible += pts;
      const ok = evaluateQuestion(q, answers?.[q.id]);
      if (ok) earned += pts;
    }

    // If the quiz uses totalPoints that differs from sum(question.points), scale proportionally.
    const scaledEarned = possible > 0 ? (earned / possible) * totalPoints : 0;
    const percent = totalPoints > 0 ? (scaledEarned / totalPoints) * 100 : 0;

    return {
      earnedPoints: Math.round(scaledEarned * 100) / 100,
      totalPoints,
      percent: Math.round(percent * 100) / 100,
    };
  }

  async function writeCompletionToFirebase({ uid, quizId, earnedPoints }) {
    if (!uid) return;
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return;

    const FieldValue = firebase.firestore.FieldValue;
    const db = firebase.firestore();

    await db.collection('users').doc(uid).set({
      profile: {
        learning_stats: {
          total_learning_points: FieldValue.increment(Number(earnedPoints) || 0),
          completed_quizzes: FieldValue.arrayUnion(quizId),
          updated_at: new Date(),
        },
        quiz_stats: {
          [quizId]: {
            final_score: Number(earnedPoints) || 0,
            completed_at: new Date(),
            status: 'completed'
          }
        }
      }
    }, { merge: true });
  }

  async function writeQuizAttemptToFirebase({ uid, quizId, percent, pass, earnedPoints, passingScorePercent }) {
    if (!uid) return;
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return;

    const db = firebase.firestore();

    await db.collection('users').doc(uid).set({
      profile: {
        quiz_stats: {
          [quizId]: {
            last_attempt_percent: Number(percent) || 0,
            last_attempt_at: new Date(),
            passing_score_percent: Number(passingScorePercent) || 0,
            passed_threshold: !!pass,
            last_earned_points: Number(earnedPoints) || 0,
            status: pass ? 'passed' : 'attempted'
          }
        }
      }
    }, { merge: true });
  }

  async function notifyBackendQuizAttempt({ quizId, percent, pass }) {
    try {
      const fb = typeof window !== 'undefined' ? window.firebase : null;
      if (!fb || !fb.auth) return;
      const user = fb.auth().currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();

      await fetch('/api/notifications/quiz-attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          quizId,
          percent: Number(percent) || 0,
          pass: !!pass,
          occurredAt: Date.now(),
        }),
      }).catch(() => {});
    } catch {}
  }

  function parseQuizMarkdown(text) {
    const lines = text.split('\n');
    const quiz = {
      quiz_id: '',
      title: '',
      totalPoints: 100,
      passingScorePercent: 90,
      questions: []
    };

    let currentQuestion = null;
    let inOptions = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Header metadata
      if (line.startsWith('# QUIZ_ID:')) {
        quiz.quiz_id = line.replace('# QUIZ_ID:', '').trim();
        continue;
      }
      if (line.startsWith('# TITLE:')) {
        quiz.title = line.replace('# TITLE:', '').trim();
        continue;
      }

      // Configuration
      if (line.startsWith('- **Total Points:**')) {
        quiz.totalPoints = parseInt(line.match(/\d+/)?.[0] || '100');
        continue;
      }
      if (line.startsWith('- **Passing Score:**')) {
        quiz.passingScorePercent = parseInt(line.match(/\d+/)?.[0] || '90');
        continue;
      }

      // Question detection
      if (line.startsWith('### QUESTION')) {
        if (currentQuestion) quiz.questions.push(currentQuestion);
        currentQuestion = {
          id: `q_${quiz.questions.length + 1}`,
          title: line.replace(/^### QUESTION \d+:\s*/, '').trim(),
          type: 'SINGLE_CHOICE',
          points: 10,
          timeLimitSec: null,
          prompt: '',
          options: []
        };
        inOptions = false;
        continue;
      }

      if (!currentQuestion) continue;

      // Question properties
      if (line.startsWith('- **Type:**')) {
        currentQuestion.type = line.replace('- **Type:**', '').trim();
        continue;
      }
      if (line.startsWith('- **Points:**')) {
        currentQuestion.points = parseInt(line.match(/\d+/)?.[0] || '10');
        continue;
      }
      if (line.startsWith('- **Timer:**')) {
        const t = line.replace('- **Timer:**', '').trim();
        currentQuestion.timeLimitSec = t.toLowerCase() === 'null' ? null : parseInt(t);
        continue;
      }
      if (line.startsWith('- **Prompt:**')) {
        currentQuestion.prompt = line.replace('- **Prompt:**', '').trim();
        continue;
      }

      // Options detection
      if (line.startsWith('**OPTIONS:**')) {
        inOptions = true;
        continue;
      }

      if (inOptions && (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.') || line.startsWith('5.'))) {
        const isCorrect = line.includes('[x]');
        const text = line.replace(/^\d+\.\s*\[[ x]\]\s*/, '').trim();
        currentQuestion.options.push({
          id: `opt_${currentQuestion.options.length + 1}`,
          text: text,
          isCorrect: isCorrect
        });
        continue;
      }

      // Correct logic for OPEN_FIELD
      if (line.startsWith('**CORRECT_LOGIC:**')) {
        const logicText = line.replace('**CORRECT_LOGIC:**', '').trim();
        const mustContainMatch = logicText.match(/\((.*?)\)/);
        if (mustContainMatch) {
          const fragments = mustContainMatch[1].split('/').map(f => f.trim().toLowerCase());
          currentQuestion.correctLogic = { mustContain: fragments };
        }
        continue;
      }
    }

    if (currentQuestion) quiz.questions.push(currentQuestion);
    return quiz;
  }

  function QuizWidget({ quizId }) {
    const uid = getCurrentUid();

    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);

    const [idx, setIdx] = useState(0);
    const [answers, setAnswers] = useState({});

    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState(null);

    const [showModal, setShowModal] = useState(false);

    const [secondsLeft, setSecondsLeft] = useState(null);

    const cooldownMs = 2 * 24 * 60 * 60 * 1000;

    const attemptState = useMemo(() => readAttemptState(uid, quizId), [uid, quizId]);
    const lockMs = useMemo(() => {
      if (!attemptState) return 0;
      if (attemptState.lastResult === 'pass') return 0;
      return msUntilAllowed(attemptState.lastAttemptTs, cooldownMs);
    }, [attemptState]);

    const passingScorePercent = useMemo(() => {
      const p = Number(quiz?.passingScorePercent);
      if (Number.isFinite(p) && p > 0) return p;
      return 90;
    }, [quiz]);

    useEffect(() => {
      if (!quizId) {
        setQuiz(null);
        return;
      }

      let cancelled = false;
      setLoading(true);
      setLoadError(null);

      // Fetch .md instead of .json
      fetch(`/data/quizes/${encodeURIComponent(quizId)}.md`)
        .then(r => {
          if (!r.ok) {
            // Fallback to template if specific file not found (for testing)
            if (quizId === 'test_quiz') return fetch('/data/quizes/quiz_template.md');
            throw new Error(`Quiz not found (${r.status})`);
          }
          return r;
        })
        .then(r => r.text())
        .then(text => {
          if (cancelled) return;
          const parsed = parseQuizMarkdown(text);
          setQuiz(parsed);
          setIdx(0);
          setAnswers({});
          setSubmitted(false);
          setResult(null);
          setShowModal(false);
        })
        .catch(e => {
          if (cancelled) return;
          setQuiz(null);
          setLoadError(e?.message || 'Failed to load quiz');
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [quizId]);

    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const current = questions[idx] || null;

    // Timer per question
    useEffect(() => {
      if (!current || submitted) {
        setSecondsLeft(null);
        return;
      }

      const tl = current.timeLimitSec;
      if (!Number.isFinite(tl) || tl === null) {
        setSecondsLeft(null);
        return;
      }

      let remaining = Number(tl);
      setSecondsLeft(remaining);

      const t = setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          clearInterval(t);
          // auto-advance if possible
          setIdx(prev => Math.min(prev + 1, questions.length - 1));
        }
      }, 1000);

      return () => clearInterval(t);
    }, [current?.id, submitted]);

    const setAnswer = useCallback((qId, value) => {
      setAnswers(prev => ({ ...prev, [qId]: value }));
    }, []);

    const canAttempt = lockMs === 0;

    const goPrev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
    const goNext = useCallback(() => setIdx(i => Math.min(questions.length - 1, i + 1)), [questions.length]);

    const submit = useCallback(async () => {
      if (!quiz || questions.length === 0) return;

      const score = computeScore(quiz, answers);
      const pass = score.percent >= passingScorePercent;

      const nextResult = {
        ...score,
        pass,
        passingScorePercent,
      };

      setSubmitted(true);
      setResult(nextResult);
      setShowModal(true);

      writeAttemptState(uid, quizId, {
        lastAttemptTs: Date.now(),
        lastResult: pass ? 'pass' : 'fail',
        percent: nextResult.percent,
        earnedPoints: nextResult.earnedPoints,
      });

      try {
        await writeQuizAttemptToFirebase({
          uid,
          quizId,
          percent: nextResult.percent,
          pass,
          earnedPoints: nextResult.earnedPoints,
          passingScorePercent: nextResult.passingScorePercent,
        });
      } catch (e) {
        console.warn('[QuizEngine] Failed to write attempt to Firebase:', e);
      }

      notifyBackendQuizAttempt({ quizId, percent: nextResult.percent, pass }).catch(() => {});

      if (pass) {
        try {
          await writeCompletionToFirebase({ uid, quizId, earnedPoints: nextResult.earnedPoints });
        } catch (e) {
          console.warn('[QuizEngine] Failed to update Firebase:', e);
        }
      }
    }, [quiz, questions.length, answers, passingScorePercent, uid, quizId]);

    const resetForRetry = useCallback(() => {
      setIdx(0);
      setAnswers({});
      setSubmitted(false);
      setResult(null);
      setShowModal(false);
    }, []);

    if (!quizId) return null;

    if (loading) {
      return window.React.createElement('div', { style: styles.container },
        window.React.createElement('div', { style: styles.header },
          window.React.createElement('div', { style: styles.title }, 'Quiz')
        ),
        window.React.createElement('div', { style: styles.body }, 'Loading quiz...')
      );
    }

    if (loadError) {
      return window.React.createElement('div', { style: styles.container },
        window.React.createElement('div', { style: styles.header },
          window.React.createElement('div', { style: styles.title }, 'Quiz')
        ),
        window.React.createElement('div', { style: styles.body },
          window.React.createElement('div', { style: { color: '#f87171' } }, loadError)
        )
      );
    }

    if (!quiz || questions.length === 0) {
      return null;
    }

    // Locked state (failed recently)
    if (!canAttempt) {
      return window.React.createElement('div', { style: styles.container },
        window.React.createElement('div', { style: styles.header },
          window.React.createElement('div', { style: styles.title }, quiz.title || 'Quiz')
        ),
        window.React.createElement('div', { style: styles.body },
          window.React.createElement('div', { style: { color: '#94a3b8', marginBottom: '0.5rem' } }, 'Reattempt locked'),
          window.React.createElement('div', { style: { color: '#e2e8f0' } }, `Try again in ${formatDuration(lockMs)}.`)
        )
      );
    }

    // After completion we keep only the score window modal; the quiz panel stays minimal.
    const progressText = `${idx + 1}/${questions.length}`;

    return window.React.createElement('div', { style: styles.container },
      window.React.createElement('div', { style: styles.header },
        window.React.createElement('div', null,
          window.React.createElement('div', { style: styles.title }, quiz.title || 'Quiz'),
          window.React.createElement('div', { style: styles.subtitle }, quiz.quiz_id ? `Quiz ID: ${quiz.quiz_id}` : `Quiz ID: ${quizId}`)
        ),
        window.React.createElement('div', { style: styles.progressBadge }, progressText)
      ),

      window.React.createElement('div', { style: styles.body },
        current ? window.React.createElement('div', { style: styles.card },
          window.React.createElement('div', { style: styles.qMeta },
            window.React.createElement('div', { style: styles.qTitle }, current.title || `Question ${idx + 1}`),
            secondsLeft !== null ? window.React.createElement('div', { style: styles.timer }, `${secondsLeft}s`) : null
          ),
          window.React.createElement('div', { style: styles.prompt }, current.prompt || ''),

          current.type === 'SINGLE_CHOICE' ? window.React.createElement('div', { style: styles.options },
            (current.options || []).map(opt => window.React.createElement('label', { key: opt.id, style: styles.option },
              window.React.createElement('input', {
                type: 'radio',
                name: `q_${current.id}`,
                checked: answers[current.id] === opt.id,
                onChange: () => setAnswer(current.id, opt.id)
              }),
              window.React.createElement('span', { style: { marginLeft: '0.5rem' } }, opt.text)
            ))
          ) : null,

          current.type === 'MULTI_CHOICE' ? window.React.createElement('div', { style: styles.options },
            (current.options || []).map(opt => {
              const curArr = Array.isArray(answers[current.id]) ? answers[current.id] : [];
              const checked = curArr.includes(opt.id);
              return window.React.createElement('label', { key: opt.id, style: styles.option },
                window.React.createElement('input', {
                  type: 'checkbox',
                  checked,
                  onChange: () => {
                    const next = checked ? curArr.filter(x => x !== opt.id) : [...curArr, opt.id];
                    setAnswer(current.id, next);
                  }
                }),
                window.React.createElement('span', { style: { marginLeft: '0.5rem' } }, opt.text)
              );
            })
          ) : null,

          current.type === 'OPEN_FIELD' ? window.React.createElement('div', null,
            window.React.createElement('textarea', {
              value: answers[current.id] || '',
              onChange: (e) => setAnswer(current.id, e.target.value),
              placeholder: 'Type your answer...',
              style: styles.textarea
            })
          ) : null
        ) : null,

        window.React.createElement('div', { style: styles.navRow },
          window.React.createElement('button', { style: styles.navBtn, onClick: goPrev, disabled: idx === 0 }, '←'),
          window.React.createElement('div', { style: styles.dots },
            questions.map((q, i) => window.React.createElement('div', {
              key: q.id,
              style: {
                ...styles.dot,
                background: i === idx ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)'
              }
            }))
          ),
          window.React.createElement('button', { style: styles.navBtn, onClick: goNext, disabled: idx === questions.length - 1 }, '→')
        ),

        window.React.createElement('div', { style: styles.actionRow },
          window.React.createElement('button', {
            style: styles.submitBtn,
            onClick: submit,
          }, 'Submit Quiz')
        )
      ),

      showModal && result ? window.React.createElement('div', { style: styles.modalOverlay },
        window.React.createElement('div', { style: styles.modal },
          window.React.createElement('div', { style: styles.modalTitle }, result.pass ? 'Score Window' : 'Score Window'),
          window.React.createElement('div', { style: styles.modalScore }, `${result.percent}%`),
          window.React.createElement('div', { style: styles.modalSub }, `Points: ${result.earnedPoints}/${result.totalPoints} | Pass: ${passingScorePercent}%`),

          !result.pass ? window.React.createElement('div', { style: styles.learnMore },
            window.React.createElement('div', { style: { fontWeight: 600, marginBottom: '0.35rem' } }, 'Learn More'),
            window.React.createElement('div', { style: { color: '#94a3b8', lineHeight: 1.4 } }, 'Review the tile description above, then reattempt in 2 days.')
          ) : null,

          window.React.createElement('div', { style: styles.modalActions },
            window.React.createElement('button', { style: styles.modalBtnSecondary, onClick: () => setShowModal(false) }, 'Close'),
            !result.pass ? window.React.createElement('button', {
              style: styles.modalBtnPrimary,
              onClick: () => {
                setShowModal(false);
                resetForRetry();
              },
              disabled: true
            }, 'Reattempt in 2 days') : window.React.createElement('button', {
              style: styles.modalBtnPrimary,
              onClick: () => setShowModal(false)
            }, 'Continue')
          )
        )
      ) : null
    );
  }

  const styles = {
    container: {
      marginTop: '1.75rem',
      border: '1px solid rgba(148, 163, 184, 0.25)',
      borderRadius: '14px',
      background: 'rgba(15, 23, 42, 0.6)',
      overflow: 'hidden',
    },
    header: {
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(148, 163, 184, 0.18)'
    },
    title: { fontWeight: 700, color: '#f7f9ff', fontSize: '1rem' },
    subtitle: { color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' },
    progressBadge: {
      background: 'rgba(56, 189, 248, 0.12)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      color: '#7dd3fc',
      padding: '0.35rem 0.6rem',
      borderRadius: '999px',
      fontSize: '0.8rem',
      fontWeight: 600
    },
    body: { padding: '1.25rem' },
    card: {
      background: 'rgba(2, 6, 23, 0.45)',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      borderRadius: '12px',
      padding: '1rem',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
    },
    qMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' },
    qTitle: { fontWeight: 700, color: '#e2e8f0' },
    timer: { color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem' },
    prompt: { color: '#e2e8f0', lineHeight: 1.5, marginBottom: '0.75rem' },
    options: { display: 'grid', gap: '0.5rem' },
    option: {
      display: 'flex',
      alignItems: 'center',
      padding: '0.6rem 0.75rem',
      borderRadius: '10px',
      background: 'rgba(148, 163, 184, 0.08)',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      cursor: 'pointer'
    },
    textarea: {
      width: '100%',
      minHeight: '110px',
      borderRadius: '10px',
      border: '1px solid rgba(148, 163, 184, 0.25)',
      background: 'rgba(2, 6, 23, 0.35)',
      color: '#f7f9ff',
      padding: '0.75rem',
      outline: 'none',
      resize: 'vertical'
    },
    navRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' },
    navBtn: {
      width: '46px',
      height: '38px',
      borderRadius: '10px',
      border: '1px solid rgba(148, 163, 184, 0.25)',
      background: 'rgba(148, 163, 184, 0.08)',
      color: '#e2e8f0',
      cursor: 'pointer'
    },
    dots: { display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', flex: 1 },
    dot: { width: '8px', height: '8px', borderRadius: '999px' },
    actionRow: { marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' },
    submitBtn: {
      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.9), rgba(14, 165, 233, 0.9))',
      border: 'none',
      color: '#00111a',
      fontWeight: 800,
      padding: '0.75rem 1rem',
      borderRadius: '12px',
      cursor: 'pointer'
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    },
    modal: {
      width: 'min(520px, 95vw)',
      background: '#0b1220',
      border: '1px solid rgba(148, 163, 184, 0.25)',
      borderRadius: '16px',
      padding: '1.25rem',
      textAlign: 'center'
    },
    modalTitle: { fontWeight: 800, color: '#f7f9ff', fontSize: '1.1rem' },
    modalScore: { fontWeight: 900, fontSize: '3rem', color: '#38bdf8', marginTop: '0.75rem' },
    modalSub: { color: '#94a3b8', marginTop: '0.25rem' },
    learnMore: {
      marginTop: '1rem',
      padding: '0.85rem',
      background: 'rgba(239, 68, 68, 0.08)',
      border: '1px solid rgba(239, 68, 68, 0.22)',
      borderRadius: '12px',
      textAlign: 'left',
      color: '#fecaca'
    },
    modalActions: { display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem' },
    modalBtnPrimary: {
      background: 'rgba(56, 189, 248, 0.9)',
      border: 'none',
      padding: '0.75rem 1rem',
      borderRadius: '12px',
      fontWeight: 800,
      cursor: 'pointer'
    },
    modalBtnSecondary: {
      background: 'transparent',
      border: '1px solid rgba(148, 163, 184, 0.25)',
      color: '#e2e8f0',
      padding: '0.75rem 1rem',
      borderRadius: '12px',
      fontWeight: 700,
      cursor: 'pointer'
    },
  };

  window.QuizEngine = {
    QuizWidget,
  };

  console.log('✅ QuizEngine registered successfully');
}
