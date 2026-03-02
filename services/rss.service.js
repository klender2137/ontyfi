// RSS Parser Service for My Hustle data
// Handles fetching and parsing RSS feeds from Optimism and Arbitrum

import Parser from 'rss-parser';
import fetch from 'node-fetch';
import { db } from './firebase-admin.js';

class RSSParserService {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'media:content'],
          ['media:thumbnail', 'media:thumbnail'],
          ['content:encoded', 'content:encoded']
        ]
      }
    });

    this.feeds = {
      optimism: 'https://optimism.mirror.xyz/feed/atom',
      arbitrum: 'https://blog.arbitrum.foundation/feed'
    };
  }

  /**
   * Parse a single RSS feed and return the latest 5 items
   * @param {string} feedUrl - URL of the RSS feed
   * @param {string} source - Source name (optimism/arbitrum)
   * @returns {Promise<Array>} Array of parsed RSS items
   */
  async parseFeed(feedUrl, source) {
    try {
      console.log(`[RSS Parser] Fetching ${source} feed: ${feedUrl}`);

      const feed = await this.parser.parseURL(feedUrl);
      const items = feed.items || [];

      // Take latest 5 items
      const latestItems = items.slice(0, 5);

      console.log(`[RSS Parser] Found ${latestItems.length} items from ${source}`);

      // Transform items to our format
      const transformedItems = latestItems.map(item => {
        // Create a unique ID from the URL
        const url = item.link || item.guid || item.id || '';
        const id = this.generateIdFromUrl(url, source);

        return {
          id,
          type: 'article',
          title: item.title || 'Untitled Article',
          description: this.extractDescription(item),
          content: item.content || item['content:encoded'] || item.summary || '',
          source,
          url,
          author: item.creator || item.author || feed.title || source,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          timestamp: new Date(),
          tags: this.generateTags(item, source)
        };
      });

      return transformedItems;

    } catch (error) {
      console.error(`[RSS Parser Error] Failed to parse ${source} feed:`, error.message);
      throw error;
    }
  }

  /**
   * Generate a unique ID from URL for deduplication
   * @param {string} url - Article URL
   * @param {string} source - Source name
   * @returns {string} Unique document ID
   */
  generateIdFromUrl(url, source) {
    if (!url) return `rss_${source}_${Date.now()}`;

    try {
      // Clean the URL and create a hash-like ID
      const cleanUrl = url.replace(/https?:\/\//, '').replace(/[^\w\-_]/g, '_');
      return `rss_${source}_${cleanUrl.substring(0, 50)}`;
    } catch (error) {
      return `rss_${source}_${Date.now()}`;
    }
  }

  /**
   * Extract description from RSS item
   * @param {Object} item - RSS item
   * @returns {string} Description text
   */
  extractDescription(item) {
    // Try different description fields
    const description = item.description ||
                       item.summary ||
                       item['content:encoded'] ||
                       item.contentSnippet ||
                       '';

    // Clean up HTML tags and truncate
    const cleanDescription = description
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Truncate to reasonable length
    return cleanDescription.length > 200
      ? cleanDescription.substring(0, 200) + '...'
      : cleanDescription;
  }

  /**
   * Generate tags for the article
   * @param {Object} item - RSS item
   * @param {string} source - Source name
   * @returns {Array<string>} Array of tags
   */
  generateTags(item, source) {
    const tags = ['article', source];

    // Add category tags if available
    if (item.categories && Array.isArray(item.categories)) {
      item.categories.forEach(category => {
        if (typeof category === 'string') {
          tags.push(category.toLowerCase());
        } else if (category._ && typeof category._ === 'string') {
          tags.push(category._.toLowerCase());
        }
      });
    }

    // Add source-specific tags
    if (source === 'optimism') {
      tags.push('layer2', 'optimism', 'op-stack');
    } else if (source === 'arbitrum') {
      tags.push('layer2', 'arbitrum', 'arbitrum-one');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Parse all RSS feeds concurrently
   * @returns {Promise<Array>} Combined array of all RSS items
   */
  async parseAllFeeds() {
    try {
      console.log('[RSS Parser] Starting to parse all RSS feeds...');

      const feedPromises = Object.entries(this.feeds).map(([source, url]) =>
        this.parseFeed(url, source)
      );

      const feedResults = await Promise.allSettled(feedPromises);

      const allItems = [];
      feedResults.forEach((result, index) => {
        const source = Object.keys(this.feeds)[index];
        if (result.status === 'fulfilled') {
          allItems.push(...result.value);
        } else {
          console.error(`[RSS Parser Error] Failed to parse ${source}:`, result.reason.message);
        }
      });

      console.log(`[RSS Parser] Successfully parsed ${allItems.length} total RSS items`);
      return allItems;

    } catch (error) {
      console.error('[RSS Parser Error] Failed to parse feeds:', error.message);
      throw error;
    }
  }

  /**
   * Save RSS data to Firestore hustle_feed collection with chunked batches
   * Uses URL-based IDs to prevent duplicates
   * @param {Array} data - Array of RSS items
   * @returns {Promise<Object>} Summary of save operation
   */
  async saveToHustleFeed(data) {
    try {
      console.log(`[RSS Parser] Saving ${data.length} RSS items to hustle_feed...`);

      const collectionRef = db.collection('hustle_feed');
      const BATCH_SIZE = 500;
      let saved = 0;
      let skipped = 0;

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = data.slice(i, i + BATCH_SIZE);
        
        for (const item of chunk) {
          try {
            const docRef = collectionRef.doc(item.id);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
              batch.set(docRef, {
                ...item,
                timestamp: item.timestamp || new Date(),
                updatedAt: new Date()
              });
              saved++;
            } else {
              skipped++;
            }
          } catch (docError) {
            console.warn(`[RSS Parser Warning] Error checking document ${item.id}:`, docError.message);
            skipped++;
          }
        }

        if (saved > 0) {
          await batch.commit();
          console.log(`[RSS Parser] Committed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
        }
      }

      console.log(`[RSS Parser] Successfully saved ${saved} new RSS items (${skipped} skipped as duplicates)`);
      return { saved, skipped, total: data.length };

    } catch (error) {
      console.error('[RSS Parser Error] Failed to save RSS data to hustle_feed:', error.message);
      throw error;
    }
  }

  /**
   * Fetch all RSS data and save to Firestore
   * @returns {Promise<Object>} Summary of operation
   */
  async fetchAndSaveAll() {
    try {
      console.log('[RSS Parser] Starting full RSS fetch and save...');

      const rssData = await this.parseAllFeeds();
      const saveResult = await this.saveToHustleFeed(rssData);

      return {
        itemsParsed: rssData.length,
        ...saveResult
      };

    } catch (error) {
      console.error('[RSS Parser Error] Failed to fetch and save RSS data:', error.message);
      throw error;
    }
  }
}

export default new RSSParserService();
