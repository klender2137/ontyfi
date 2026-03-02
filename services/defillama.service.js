// DefiLlama Service for My Hustle data
// Handles fetching yields and airdrops data from DefiLlama APIs

import fetch from 'node-fetch';
import { db } from './firebase-admin.js';

class DefiLlamaService {
  constructor() {
    this.yieldsEndpoint = 'https://yields.llama.fi/pools';
    this.airdropsEndpoint = 'https://api.llama.fi/airdrops';
  }

  /**
   * Fetch top 20 stablecoin yields sorted by APY descending
   * @returns {Promise<Array>} Array of yield pool data
   */
  async fetchStablecoinYields() {
    try {
      console.log('[DefiLlama] Fetching stablecoin yields...');

      const response = await fetch(this.yieldsEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const pools = data.data || [];

      // Filter for stablecoin pools and sort by APY descending
      const stablecoinPools = pools
        .filter(pool => pool.stablecoin === true)
        .sort((a, b) => (b.apy || 0) - (a.apy || 0))
        .slice(0, 20);

      console.log(`[DefiLlama] Found ${stablecoinPools.length} stablecoin yield pools`);

      // Transform data for Firestore
      const transformedData = stablecoinPools.map(pool => ({
        id: `yield_${pool.pool}`,
        type: 'yield',
        title: `${pool.symbol} on ${pool.project}`,
        description: `APY: ${(pool.apy || 0).toFixed(2)}% | TVL: $${(pool.tvlUsd || 0).toLocaleString()}`,
        source: 'defillama',
        url: pool.url || `https://defillama.com/yields/pool/${pool.pool}`,
        apy: pool.apy || 0,
        tvl: pool.tvlUsd || 0,
        symbol: pool.symbol,
        project: pool.project,
        timestamp: new Date(),
        tags: ['yield', 'stablecoin', pool.project.toLowerCase()]
      }));

      return transformedData;

    } catch (error) {
      console.error('[DefiLlama Error] Failed to fetch stablecoin yields:', error.message);
      throw error;
    }
  }

  /**
   * Fetch airdrops data and map to hustle_feed format
   * @returns {Promise<Array>} Array of airdrop data
   */
  async fetchAirdrops() {
    try {
      console.log('[DefiLlama] Fetching airdrops...');

      const response = await fetch(this.airdropsEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const airdrops = Array.isArray(data) ? data : [];

      console.log(`[DefiLlama] Found ${airdrops.length} airdrops`);

      // Transform data for Firestore
      const transformedData = airdrops.map(airdrop => ({
        id: `airdrop_${airdrop.name?.toLowerCase().replace(/\s+/g, '_') || 'unknown'}`,
        type: 'airdrop',
        title: airdrop.name || 'Unnamed Airdrop',
        description: airdrop.description || 'No description available',
        source: 'defillama',
        url: airdrop.link || airdrop.url || '#',
        timestamp: new Date(),
        tags: ['airdrop', 'opportunity']
      }));

      return transformedData;

    } catch (error) {
      console.error('[DefiLlama Error] Failed to fetch airdrops:', error.message);
      throw error;
    }
  }

  /**
   * Save DefiLlama data to Firestore hustle_feed collection with chunked batches
   * @param {Array} data - Array of transformed data objects
   * @returns {Promise<void>}
   */
  async saveToHustleFeed(data) {
    try {
      console.log(`[DefiLlama] Saving ${data.length} items to hustle_feed...`);

      const collectionRef = db.collection('hustle_feed');
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = data.slice(i, i + BATCH_SIZE);
        
        chunk.forEach(item => {
          const docRef = collectionRef.doc(item.id);
          batch.set(docRef, {
            ...item,
            timestamp: item.timestamp || new Date(),
            updatedAt: new Date()
          }, { merge: true });
        });
        
        await batch.commit();
        console.log(`[DefiLlama] Committed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
      }
      
      console.log('[DefiLlama] Successfully saved to hustle_feed');

    } catch (error) {
      console.error('[DefiLlama Error] Failed to save to hustle_feed:', error.message);
      throw error;
    }
  }

  /**
   * Fetch all DefiLlama data and save to Firestore
   * @returns {Promise<Object>} Summary of fetched and saved data
   */
  async fetchAndSaveAll() {
    try {
      console.log('[DefiLlama] Starting full data fetch and save...');

      const [yields, airdrops] = await Promise.all([
        this.fetchStablecoinYields(),
        this.fetchAirdrops()
      ]);

      const allData = [...yields, ...airdrops];

      if (allData.length > 0) {
        await this.saveToHustleFeed(allData);
      }

      return {
        yieldsCount: yields.length,
        airdropsCount: airdrops.length,
        totalSaved: allData.length
      };

    } catch (error) {
      console.error('[DefiLlama Error] Failed to fetch and save all data:', error.message);
      throw error;
    }
  }
}

export default new DefiLlamaService();
