// activity-analytics.routes.js - Backend service for user activity analytics
import express from 'express';
import { admin } from '../services/firebase-admin.js';

const router = express.Router();

/**
 * Get user activity summary
 */
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    console.log('[Activity Analytics] Getting summary for user:', userId);
    
    // Get user activities
    const activitiesSnapshot = await admin.firestore()
      .collection('user_activities')
      .doc(userId)
      .collection('activities')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    const activities = [];
    activitiesSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        type: data.activityType,
        timestamp: data.timestamp,
        sessionId: data.sessionId,
        isGhostUser: data.isGhostUser,
        encryptedData: data.encryptedData
      });
    });
    
    // Calculate summary statistics
    const summary = {
      totalActivities: activities.length,
      uniqueSessions: [...new Set(activities.map(a => a.sessionId))].length,
      activityTypes: {},
      recentActivities: activities.slice(0, 10),
      isGhostUser: activities.length > 0 ? activities[0].isGhostUser : true
    };
    
    // Count activity types
    activities.forEach(activity => {
      summary.activityTypes[activity.type] = (summary.activityTypes[activity.type] || 0) + 1;
    });
    
    res.json({
      success: true,
      userId,
      summary,
      activities
    });
    
  } catch (error) {
    console.error('[Activity Analytics] Get summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to get activity summary' });
  }
});

/**
 * Get global activity trends
 */
router.get('/global/trends', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    console.log('[Activity Analytics] Getting global trends for timeframe:', timeframe);
    
    // Calculate time range
    let timeRange;
    switch (timeframe) {
      case '1h':
        timeRange = 60 * 60 * 1000; // 1 hour
        break;
      case '24h':
        timeRange = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case '7d':
        timeRange = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      default:
        timeRange = 24 * 60 * 60 * 1000; // default to 24 hours
    }
    
    const cutoffTime = new Date(Date.now() - timeRange);
    
    // Get global activities
    const activitiesSnapshot = await admin.firestore()
      .collection('global_trends')
      .where('timestamp', '>=', cutoffTime)
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();
    
    const activities = [];
    activitiesSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        userId: data.userId,
        activityType: data.activityType,
        timestamp: data.timestamp,
        sessionId: data.sessionId,
        isGhostUser: data.isGhostUser
      });
    });
    
    // Calculate trends
    const trends = {
      totalActivities: activities.length,
      uniqueUsers: [...new Set(activities.map(a => a.userId))].length,
      ghostUsers: activities.filter(a => a.isGhostUser).length,
      registeredUsers: activities.filter(a => !a.isGhostUser).length,
      activityTypes: {},
      hourlyActivity: {},
      topActivities: []
    };
    
    // Count activity types
    activities.forEach(activity => {
      trends.activityTypes[activity.activityType] = (trends.activityTypes[activity.activityType] || 0) + 1;
    });
    
    // Group by hour
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp.toDate()).getHours();
      trends.hourlyActivity[hour] = (trends.hourlyActivity[hour] || 0) + 1;
    });
    
    // Get top activities
    trends.topActivities = Object.entries(trends.activityTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
    
    res.json({
      success: true,
      timeframe,
      trends,
      activities: activities.slice(0, 50) // Return recent 50 activities
    });
    
  } catch (error) {
    console.error('[Activity Analytics] Get trends error:', error);
    res.status(500).json({ error: error.message || 'Failed to get trends' });
  }
});

/**
 * Get user engagement metrics
 */
router.get('/user/:userId/engagement', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    console.log('[Activity Analytics] Getting engagement for user:', userId);
    
    // Get user activities
    const activitiesSnapshot = await admin.firestore()
      .collection('user_activities')
      .doc(userId)
      .collection('activities')
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();
    
    const activities = [];
    activitiesSnapshot.forEach(doc => {
      activities.push({
        id: doc.id,
        type: doc.data().activityType,
        timestamp: doc.data().timestamp,
        sessionId: doc.data().sessionId
      });
    });
    
    // Calculate engagement metrics
    const metrics = {
      totalSessions: [...new Set(activities.map(a => a.sessionId))].length,
      avgSessionDuration: 0,
      mostActiveHour: null,
      screenTime: {},
      articleReadTime: 0,
      searchCount: 0,
      bookmarkCount: 0,
      tileOpenCount: 0
    };
    
    // Calculate session durations and screen time
    const sessions = {};
    activities.forEach(activity => {
      const sessionId = activity.sessionId;
      if (!sessions[sessionId]) {
        sessions[sessionId] = {
          start: activity.timestamp,
          end: activity.timestamp,
          activities: []
        };
      }
      sessions[sessionId].end = activity.timestamp;
      sessions[sessionId].activities.push(activity);
      
      // Count specific activities
      switch (activity.type) {
        case 'search':
          metrics.searchCount++;
          break;
        case 'bookmark':
          metrics.bookmarkCount++;
          break;
        case 'tile_open':
          metrics.tileOpenCount++;
          break;
        case 'article_complete':
          // Extract duration from encrypted data if needed
          break;
      }
    });
    
    // Calculate average session duration
    const sessionDurations = Object.values(sessions).map(session => 
      session.end.toDate() - session.start.toDate()
    );
    metrics.avgSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length 
      : 0;
    
    res.json({
      success: true,
      userId,
      metrics,
      sessionCount: Object.keys(sessions).length
    });
    
  } catch (error) {
    console.error('[Activity Analytics] Get engagement error:', error);
    res.status(500).json({ error: error.message || 'Failed to get engagement metrics' });
  }
});

/**
 * Delete user data (GDPR compliance)
 */
router.delete('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    console.log('[Activity Analytics] Deleting user data:', userId);
    
    // Delete user activities
    const activitiesCollection = admin.firestore()
      .collection('user_activities')
      .doc(userId)
      .collection('activities');
    
    const activitiesSnapshot = await activitiesCollection.get();
    const batch = admin.firestore().batch();
    
    activitiesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // Delete user document
    await admin.firestore()
      .collection('user_activities')
      .doc(userId)
      .delete();
    
    // Also delete from global trends (optional, based on requirements)
    const globalTrendsSnapshot = await admin.firestore()
      .collection('global_trends')
      .where('userId', '==', userId)
      .get();
    
    const globalBatch = admin.firestore().batch();
    globalTrendsSnapshot.forEach(doc => {
      globalBatch.delete(doc.ref);
    });
    
    await globalBatch.commit();
    
    console.log('[Activity Analytics] User data deleted successfully:', userId);
    
    res.json({
      success: true,
      message: 'User data deleted successfully'
    });
    
  } catch (error) {
    console.error('[Activity Analytics] Delete user data error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user data' });
  }
});

export default router;
