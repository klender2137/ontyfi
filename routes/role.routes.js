import express from 'express';
import { isAdmin, getAdminUsernames, clearAdminCache } from '../services/role.service.js';

const router = express.Router();

/**
 * POST /api/role/verify-admin
 * Verify if the current user is an admin
 * Body: { username, email }
 * Response: { isAdmin: boolean }
 */
router.post('/verify-admin', async (req, res) => {
  try {
    const { username, email } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Username is required',
        isAdmin: false 
      });
    }
    
    const adminStatus = isAdmin(username, email);
    
    return res.json({
      ok: true,
      isAdmin: adminStatus,
      username: username
    });
  } catch (error) {
    console.error('[Role API] Error verifying admin:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to verify admin status',
      isAdmin: false
    });
  }
});

/**
 * GET /api/role/admins
 * Get list of admin usernames (no emails exposed)
 * For debugging/internal use only
 */
router.get('/admins', async (req, res) => {
  try {
    const usernames = getAdminUsernames();
    return res.json({
      ok: true,
      count: usernames.length,
      admins: usernames
    });
  } catch (error) {
    console.error('[Role API] Error fetching admins:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch admin list'
    });
  }
});

/**
 * POST /api/role/refresh-cache
 * Clear admin cache (useful after updating admins file)
 */
router.post('/refresh-cache', async (req, res) => {
  try {
    clearAdminCache();
    return res.json({
      ok: true,
      message: 'Admin cache cleared'
    });
  } catch (error) {
    console.error('[Role API] Error clearing cache:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to clear cache'
    });
  }
});

export default router;
