// My Hustle Data Service - Main coordinator for all external data sources
// Aggregates data from DefiLlama and RSS feeds into the hustle_feed collection

import defiLlamaService from './defillama.service.js';
import rssService from './rss.service.js';
import { db } from './firebase-admin.js';

class MyHustleService {
  constructor() {
    this.collectionName = 'hustle_feed';
  }

  /**
   * Fetch all data from external sources and update hustle_feed
   * @returns {Promise<Object>} Summary of all operations
   */
  async updateAllData() {
    try {
      console.log('[My Hustle] Starting full data update...');

      const startTime = Date.now();

      // Run all services concurrently
      const [defiLlamaResult, rssResult] = await Promise.allSettled([
        defiLlamaService.fetchAndSaveAll(),
        rssService.fetchAndSaveAll()
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Process results
      const results = {
        duration,
        timestamp: new Date(),
        services: {}
      };

      // DefiLlama results
      if (defiLlamaResult.status === 'fulfilled') {
        results.services.defiLlama = {
          status: 'success',
          ...defiLlamaResult.value
        };
        console.log('[My Hustle] DefiLlama data updated successfully');
      } else {
        results.services.defiLlama = {
          status: 'error',
          error: defiLlamaResult.reason.message
        };
        console.error('[My Hustle] DefiLlama update failed:', defiLlamaResult.reason.message);
      }

      // RSS results
      if (rssResult.status === 'fulfilled') {
        results.services.rss = {
          status: 'success',
          ...rssResult.value
        };
        console.log('[My Hustle] RSS data updated successfully');
      } else {
        results.services.rss = {
          status: 'error',
          error: rssResult.reason.message
        };
        console.error('[My Hustle] RSS update failed:', rssResult.reason.message);
      }

      // Save summary to Firestore
      await this.saveUpdateSummary(results);

      console.log(`[My Hustle] Data update completed in ${duration}ms`);
      return results;

    } catch (error) {
      console.error('[My Hustle Error] Failed to update all data:', error.message);
      throw error;
    }
  }

  /**
   * Update only DefiLlama data
   * @returns {Promise<Object>} DefiLlama operation results
   */
  async updateDefiLlamaData() {
    try {
      console.log('[My Hustle] Updating DefiLlama data...');
      const result = await defiLlamaService.fetchAndSaveAll();

      await this.saveUpdateSummary({
        timestamp: new Date(),
        services: { defiLlama: { status: 'success', ...result } }
      });

      return result;
    } catch (error) {
      console.error('[My Hustle Error] DefiLlama update failed:', error.message);
      throw error;
    }
  }

  /**
   * Update only RSS data
   * @returns {Promise<Object>} RSS operation results
   */
  async updateRSSData() {
    try {
      console.log('[My Hustle] Updating RSS data...');
      const result = await rssService.fetchAndSaveAll();

      await this.saveUpdateSummary({
        timestamp: new Date(),
        services: { rss: { status: 'success', ...result } }
      });

      return result;
    } catch (error) {
      console.error('[My Hustle Error] RSS update failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current data from hustle_feed collection (no combined filters)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of hustle feed items
   */
  async getHustleFeed(options = {}) {
    try {
      const {
        limit = 50,
        type = null,
        source = null,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = options;

      console.log(`[My Hustle] Fetching hustle feed (limit: ${limit})...`);

      let query = db.collection(this.collectionName);

      // CRITICAL: Use ONLY filter OR sort, never both (avoids index requirement)
      if (type) {
        query = query.where('type', '==', type).limit(limit);
      } else if (source) {
        query = query.where('source', '==', source).limit(limit);
      } else {
        // No filter, just sort
        query = query.orderBy(sortBy, sortOrder).limit(limit);
      }

      const snapshot = await query.get();
      const items = [];

      snapshot.forEach(doc => {
        items.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log(`[My Hustle] Retrieved ${items.length} hustle feed items`);
      return items;

    } catch (error) {
      console.error('[My Hustle Error] Failed to get hustle feed:', error.message);
      console.error('[My Hustle Error] Full error:', error);
      
      // If index error, log the creation URL
      if (error.message && error.message.includes('index')) {
        console.error('[My Hustle Error] CREATE INDEX AT:', error.message.match(/https?:\/\/[^\s]+/)?.[0]);
      }
      
      throw error;
    }
  }

  /**
   * Save update summary to Firestore
   * @param {Object} summary - Update operation summary
   * @returns {Promise<void>}
   */
  async saveUpdateSummary(summary) {
    try {
      const docRef = db.collection('hustle_updates').doc();
      await docRef.set({
        ...summary,
        createdAt: new Date()
      });
    } catch (error) {
      console.warn('[My Hustle Warning] Failed to save update summary:', error.message);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get statistics about the hustle_feed collection with defensive programming
   * @returns {Promise<Object>} Collection statistics
   */
  async getFeedStats() {
    try {
      console.log('[My Hustle] Calculating feed statistics...');

      const snapshot = await db.collection(this.collectionName).get();
      const stats = {
        totalItems: snapshot.size,
        byType: {},
        bySource: {},
        latestUpdate: null
      };

      snapshot.forEach(doc => {
        const data = doc.data();

        // Count by type
        const type = data.type || 'unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;

        // Count by source
        const source = data.source || 'unknown';
        stats.bySource[source] = (stats.bySource[source] || 0) + 1;

        // Track latest update with defensive check
        const itemDate = data.timestamp || data.updatedAt;
        if (itemDate) {
          // Check if it's a Firestore Timestamp object
          const dateValue = typeof itemDate.toDate === 'function' ? itemDate.toDate() : new Date(itemDate);
          if (!stats.latestUpdate || dateValue > stats.latestUpdate) {
            stats.latestUpdate = dateValue;
          }
        }
      });

      console.log(`[My Hustle] Stats calculated: ${stats.totalItems} total items`);
      return stats;

    } catch (error) {
      console.error('[My Hustle Error] Failed to get feed stats:', error.message);
      throw error;
    }
  }

  /**
   * Clean old items from hustle_feed (optional maintenance)
   * @param {number} daysOld - Remove items older than this many days
   * @returns {Promise<number>} Number of items removed
   */
  async cleanOldItems(daysOld = 30) {
    try {
      console.log(`[My Hustle] Cleaning items older than ${daysOld} days...`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const snapshot = await db.collection(this.collectionName)
        .where('timestamp', '<', cutoffDate)
        .get();

      if (snapshot.empty) {
        console.log('[My Hustle] No old items to clean');
        return 0;
      }

      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`[My Hustle] Cleaned ${snapshot.size} old items`);
      return snapshot.size;

    } catch (error) {
      console.error('[My Hustle Error] Failed to clean old items:', error.message);
      throw error;
    }
  }
}

export default new MyHustleService();
