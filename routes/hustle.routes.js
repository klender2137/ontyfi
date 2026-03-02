// My Hustle API Routes
// Provides endpoints for managing hustle feed data

import express from 'express';
import myHustleService from '../services/myhustle.service.js';

const router = express.Router();

// Update all hustle data (DefiLlama + RSS)
router.post('/update', async (req, res) => {
  console.log('[API] POST /api/hustle/update - Starting data update...');
  try {
    const result = await myHustleService.updateAllData();
    console.log('[API] POST /api/hustle/update - Data update completed:', result);
    res.json({
      success: true,
      message: 'Hustle data updated successfully',
      data: result
    });
  } catch (error) {
    console.error('[API] POST /api/hustle/update failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update hustle data',
      details: error.message
    });
  }
});

// Get hustle feed data with safe parameter parsing
router.get('/feed', async (req, res) => {
  console.log('[API] GET /api/hustle/feed - Fetching feed data');
  try {
    const {
      limit = '50',
      type,
      source,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    // Safe integer parsing with fallback
    const parsedLimit = parseInt(limit);
    const safeLimit = isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 500);

    console.log(`[API] GET /api/hustle/feed - Params: limit=${safeLimit}, type=${type}, source=${source}`);

    const items = await myHustleService.getHustleFeed({
      limit: safeLimit,
      type,
      source,
      sortBy,
      sortOrder
    });

    console.log(`[API] GET /api/hustle/feed - Returning ${items.length} items`);
    res.json({
      success: true,
      data: items,
      count: items.length
    });
  } catch (error) {
    console.error('[API] GET /api/hustle/feed failed:', error.message);
    console.error('[API] Full error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hustle feed',
      details: error.message,
      code: error.code,
      fullError: error.toString()
    });
  }
});

// Get hustle feed statistics
router.get('/stats', async (req, res) => {
  console.log('[API] GET /api/hustle/stats - Fetching statistics');
  try {
    const stats = await myHustleService.getFeedStats();
    console.log('[API] GET /api/hustle/stats - Stats:', stats);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[API] GET /api/hustle/stats failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hustle stats',
      details: error.message
    });
  }
});

// Update only DefiLlama data
router.post('/update/defillama', async (req, res) => {
  console.log('[API] POST /api/hustle/update/defillama - Updating DefiLlama data...');
  try {
    const result = await myHustleService.updateDefiLlamaData();
    console.log('[API] POST /api/hustle/update/defillama - DefiLlama update completed:', result);
    res.json({
      success: true,
      message: 'DefiLlama data updated successfully',
      data: result
    });
  } catch (error) {
    console.error('[API] POST /api/hustle/update/defillama failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update DefiLlama data',
      details: error.message
    });
  }
});

// Update only RSS data
router.post('/update/rss', async (req, res) => {
  console.log('[API] POST /api/hustle/update/rss - Updating RSS data...');
  try {
    const result = await myHustleService.updateRSSData();
    console.log('[API] POST /api/hustle/update/rss - RSS update completed:', result);
    res.json({
      success: true,
      message: 'RSS data updated successfully',
      data: result
    });
  } catch (error) {
    console.error('[API] POST /api/hustle/update/rss failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update RSS data',
      details: error.message
    });
  }
});

// Clean old items (maintenance endpoint)
router.post('/clean/:days', async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 30;
    console.log(`[API] POST /api/hustle/clean/${days} - Cleaning old items...`);

    const removedCount = await myHustleService.cleanOldItems(days);

    res.json({
      success: true,
      message: `Cleaned ${removedCount} old items`,
      data: { removedCount }
    });
  } catch (error) {
    console.error(`[API] POST /api/hustle/clean/${req.params.days} failed:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to clean old items',
      details: error.message
    });
  }
});

export default router;
