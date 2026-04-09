// questionnaire.routes.js - Protected Finance Fit Questionnaire Routes
import express from 'express';
import { admin } from '../services/firebase-admin.js';

const router = express.Router();

/**
 * Middleware to verify Firebase authentication token
 * Replaces wallet-based authentication with session-based authentication
 */
async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    req.userId = decodedToken.uid;

    next();
  } catch (error) {
    console.error('[Questionnaire] Auth verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * GET /api/questionnaire/status - Check if user has completed the questionnaire
 */
router.get('/status', verifyAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.json({
        completed: false,
        hasFiResult: false,
        message: 'User profile not found'
      });
    }

    const userData = userDoc.data();
    const fiResult = userData.fi_result || null;
    const completed = !!fiResult && !!fiResult.completedAt;

    res.json({
      completed,
      hasFiResult: !!fiResult,
      fiResult: fiResult ? {
        score: fiResult.score,
        completedAt: fiResult.completedAt,
        profile: fiResult.profile
      } : null,
      linkedinSub: userData.linkedin_sub || null
    });

  } catch (error) {
    console.error('[Questionnaire] Status check error:', error);
    res.status(500).json({ error: 'Failed to check questionnaire status' });
  }
});

/**
 * POST /api/questionnaire/submit - Submit Finance Fit Questionnaire answers
 * Calculates F_i (Finance Fit Index) and saves to user profile
 * Uses LinkedIn OAuth session token for authorization instead of wallet signature
 */
router.post('/submit', verifyAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'Invalid answers format' });
    }

    // Validate user has LinkedIn authentication
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Verify LinkedIn authentication (primary identifier after migration)
    if (!userData.linkedin_sub && !userData.identities?.includes('linkedin')) {
      return res.status(403).json({
        error: 'LinkedIn authentication required to submit questionnaire'
      });
    }

    // Calculate F_i (Finance Fit Index)
    // Score ranges from 0-100 based on questionnaire answers
    const fiResult = calculateFiScore(answers);

    // Save F_i result to user document
    const fiData = {
      score: fiResult.score,
      profile: fiResult.profile,
      answers: answers, // Store raw answers for potential reprocessing
      completedAt: new Date(),
      submittedBy: userData.linkedin_sub || userId, // Use LinkedIn sub as primary identifier
      authMethod: 'linkedin_oidc'
    };

    await admin.firestore().collection('users').doc(userId).update({
      fi_result: fiData,
      'metadata.last_active': new Date()
    });

    console.log(`[Questionnaire] F_i result saved for user ${userId}:`, fiResult);

    res.json({
      success: true,
      fiResult: {
        score: fiResult.score,
        profile: fiResult.profile,
        completedAt: fiData.completedAt
      },
      message: 'Finance Fit Index calculated and saved successfully'
    });

  } catch (error) {
    console.error('[Questionnaire] Submit error:', error);
    res.status(500).json({ error: 'Failed to submit questionnaire' });
  }
});

/**
 * GET /api/questionnaire/results - Get user's F_i results
 */
router.get('/results', verifyAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const fiResult = userData.fi_result;

    if (!fiResult) {
      return res.status(404).json({
        error: 'No Finance Fit Index results found. Please complete the questionnaire first.'
      });
    }

    res.json({
      success: true,
      fiResult: {
        score: fiResult.score,
        profile: fiResult.profile,
        completedAt: fiResult.completedAt,
        answers: fiResult.answers || []
      }
    });

  } catch (error) {
    console.error('[Questionnaire] Results fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch questionnaire results' });
  }
});

/**
 * Calculate F_i (Finance Fit Index) score based on questionnaire answers
 * @param {Array} answers - Array of answer objects with questionId and value
 * @returns {Object} - { score, profile }
 */
function calculateFiScore(answers) {
  // Map answers to categories
  const categories = {
    riskTolerance: 0,
    investmentKnowledge: 0,
    financialStability: 0,
    timeHorizon: 0,
    investmentStyle: 0
  };

  // Process answers and accumulate scores per category
  answers.forEach(answer => {
    if (answer.category && categories.hasOwnProperty(answer.category)) {
      categories[answer.category] += parseInt(answer.value) || 0;
    }
  });

  // Calculate total score (0-100)
  const maxScorePerCategory = 20;
  const totalMaxScore = Object.keys(categories).length * maxScorePerCategory;

  let totalScore = 0;
  for (const category of Object.keys(categories)) {
    // Normalize each category score to 0-20 range
    const normalizedScore = Math.min(categories[category], maxScorePerCategory);
    totalScore += normalizedScore;
  }

  // Calculate percentage score (0-100)
  const score = Math.round((totalScore / totalMaxScore) * 100);

  // Determine investor profile based on score
  let profile;
  if (score < 20) {
    profile = 'Conservative Saver';
  } else if (score < 40) {
    profile = 'Cautious Investor';
  } else if (score < 60) {
    profile = 'Balanced Investor';
  } else if (score < 80) {
    profile = 'Growth Investor';
  } else {
    profile = 'Aggressive Growth Investor';
  }

  return {
    score,
    profile,
    categories
  };
}

export default router;
