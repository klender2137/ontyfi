const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio');

admin.initializeApp();

async function fetchJson(url, { timeout = 20000, headers = {} } = {}) {
  const resp = await axios.get(url, {
    timeout,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CryptoExplorerBot/1.0; +https://cryptoexplorer.local)',
      ...headers
    }
  });
  return resp.data;
}

async function fetchEthUsd() {
  try {
    const data = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const price = data && data.ethereum && data.ethereum.usd;
    return (typeof price === 'number' && Number.isFinite(price)) ? price : null;
  } catch (e) {
    console.error('fetchEthUsd error:', e);
    return null;
  }
}

async function fetchSolUsd() {
  try {
    const data = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const price = data && data.solana && data.solana.usd;
    return (typeof price === 'number' && Number.isFinite(price)) ? price : null;
  } catch (e) {
    console.error('fetchSolUsd error:', e);
    return null;
  }
}

function toNumber(x) {
  if (x === null || typeof x === 'undefined') return null;
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function safeDocId(id) {
  return (id || '').toString().trim().replace(/\//g, '_');
}

async function fetchFlashbotsBlocks() {
  console.log('🔥 [FLASHBOTS] Starting Flashbots blocks fetch...');
  try {
    const data = await fetchJson('https://blocks.flashbots.net/v1/blocks', { timeout: 20000 });
    console.log('🔥 [FLASHBOTS] Raw response type:', typeof data, 'length:', Array.isArray(data) ? data.length : 'N/A');
    
    if (!Array.isArray(data)) {
      console.log('🔥 [FLASHBOTS] Unexpected response format:', typeof data);
      // Try alternative endpoint
      try {
        console.log('🔥 [FLASHBOTS] Trying alternative endpoint...');
        const altData = await fetchJson('https://blocks.flashbots.net/v1/blocks?limit=10', { timeout: 20000 });
        console.log('🔥 [FLASHBOTS] Alternative response:', Array.isArray(altData) ? altData.length : 'Not array');
        return Array.isArray(altData) ? altData.slice(0, 50) : [];
      } catch (altError) {
        console.error('🔥 [FLASHBOTS] Alternative endpoint failed:', altError);
        return [];
      }
    }
    
    const validBlocks = data.filter(b => b && typeof b === 'object' && b.block_number);
    console.log('🔥 [FLASHBOTS] Valid blocks found:', validBlocks.length, '/', data.length);
    
    return validBlocks.slice(0, 50);
  } catch (e) {
    console.error('🔥 [FLASHBOTS] Flashbots fetch error:', e);
    return [];
  }
}

function mapFlashbotsBundleType(bundleType) {
  const t = (bundleType || '').toString().toLowerCase();
  if (t.includes('sandwich')) return 'Sandwich';
  if (t.includes('arb')) return 'Arbitrage';
  if (t.includes('liquid')) return 'Liquidation';
  return 'Arbitrage';
}

async function fetchZeroMevRisk(txHash) {
  try {
    const apiUrl = functions.config() && functions.config().zeromev && functions.config().zeromev.api_url;
    const apiKey = functions.config() && functions.config().zeromev && functions.config().zeromev.api_key;
    if (!apiUrl || !apiKey || !txHash) return null;

    const data = await axios.get(apiUrl, {
      timeout: 20000,
      params: { tx_hash: txHash },
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const label = data && data.data && (data.data.risk_score || data.data.label || data.data.category);
    const l = (label || '').toString().toLowerCase();
    if (l.includes('toxic')) return 'Toxic';
    if (l.includes('benign')) return 'Benign';
    return null;
  } catch (e) {
    console.error('fetchZeroMevRisk error:', e);
    return null;
  }
}

async function fetchMevWatchHealth() {
  const urls = [
    functions.config() && functions.config().mevwatch && functions.config().mevwatch.health_url,
    'https://mev.watch/api/v1/health',
    'https://mev.watch/api/v1/relays'
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const data = await fetchJson(url, { timeout: 20000 });
      return { url, data };
    } catch (e) {
      console.error('fetchMevWatchHealth error url=', url, e);
    }
  }
  return null;
}

function normalizeMevWatchHealth(payload) {
  if (!payload || !payload.data) return null;
  const d = payload.data;

  const censorshipPercent = toNumber(d && (d.censorship_percent !== undefined ? d.censorship_percent : (d.censorshipPercentage !== undefined ? d.censorshipPercentage : (d.censorship !== undefined ? d.censorship : undefined))));
  const relayLatencyMs = toNumber(d && (d.relay_latency_ms !== undefined ? d.relay_latency_ms : (d.relayLatencyMs !== undefined ? d.relayLatencyMs : (d.latency_ms !== undefined ? d.latency_ms : (d.latency !== undefined ? d.latency : undefined)))));

  let status = 'Unknown';
  if (typeof censorshipPercent === 'number') {
    if (censorshipPercent >= 20) status = 'High Censorship';
    else if (censorshipPercent >= 5) status = 'Elevated';
    else status = 'Open Market';
  }

  return {
    censorship_percent: censorshipPercent,
    relay_latency_ms: relayLatencyMs,
    status
  };
}

function buildFlashbotsHustles(blocks, ethUsd) {
  console.log(' [FLASHBOTS] Building hustles from', blocks.length, 'blocks');
  
  return blocks
    .map((b, idx) => {
      const blockNumber = b && b.block_number;
      if (!blockNumber) {
        console.log(` [FLASHBOTS] Skipping block ${idx}: no block_number`);
        return null;
      }

      const totalRewardEth = toNumber(b && b.total_reward);
      const profitUsd = (typeof totalRewardEth === 'number' && typeof ethUsd === 'number')
        ? Number((totalRewardEth * ethUsd).toFixed(2))
        : null;

      const docId = safeDocId(b && b.transaction_hash || b && b.block_hash || `flashbots-block-${blockNumber}`);
      const bundleType = b && b.bundle_type || 'unknown';
      
      console.log(` [FLASHBOTS] Block ${blockNumber}: ${bundleType}, reward: ${totalRewardEth} ETH, profit: $${profitUsd}`);

      return {
        docId,
        data: {
          hustle_id: docId,
          title: `Flashbots ${mapFlashbotsBundleType(bundleType)} @ block ${blockNumber}`,
          profit_usd: profitUsd,
          network: 'Ethereum',
          type: mapFlashbotsBundleType(bundleType),
          risk_score: null, // Will be filled later
          source_platform: 'Flashbots',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          explorer_url: `https://etherscan.io/block/${blockNumber}`,
          bundle_type: bundleType,
          block_number: blockNumber,
          total_reward_eth: totalRewardEth,
          transaction_hash: b && b.transaction_hash,
          block_hash: b && b.block_hash
        }
      };
    })
    .filter(Boolean);
}

async function fetchJitoTips() {
  console.log(' [JITO] Starting Jito tips fetch...');
  try {
    // Fallback to public Jito API if no config
    const rpcUrl = (functions.config() && functions.config().jito && functions.config().jito.rpc_url) || 'https://mainnet.block-engine.jito.wtf';
    const auth = functions.config() && functions.config().jito && functions.config().jito.auth;
    
    console.log(' [JITO] Using RPC URL:', rpcUrl);
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'CryptoExplorer/1.0'
    };
    if (auth) headers['Authorization'] = auth;

    // Get tip accounts
    console.log(' [JITO] Fetching tip accounts...');
    const resp = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'get_tip_accounts',
      params: []
    }, { timeout: 20000, headers });

    const tipAccounts = resp && resp.data && resp.data.result;
    console.log(' [JITO] Tip accounts response:', tipAccounts && tipAccounts.length || 0, 'accounts');
    
    if (!Array.isArray(tipAccounts) || tipAccounts.length === 0) {
      console.log(' [JITO] No tip accounts found, creating fallback entry');
      const now = Date.now();
      const docId = safeDocId(`jito-fallback-${Math.floor(now / 60000)}`);
      return [{
        docId,
        data: {
          hustle_id: docId,
          title: 'Jito Block Engine - Active',
          profit_usd: null,
          network: 'Solana',
          type: 'Arbitrage',
          risk_score: 'Benign',
          source_platform: 'Jito',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          explorer_url: 'https://explorer.solana.com',
          status: 'No tips available'
        }
      }];
    }

    // Get recent bundles to extract tips
    console.log(' [JITO] Fetching bundle statuses...');
    try {
      const bundleResp = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 2,
        method: 'get_bundle_statuses',
        params: [{limit: 10}]
      }, { timeout: 20000, headers });
      
      const bundles = bundleResp && bundleResp.data && (bundleResp.data.result || []);
      console.log(' [JITO] Found', bundles.length, 'recent bundles');
      
      const hustles = bundles.slice(0, 5).map((bundle, idx) => {
        const now = Date.now();
        const docId = safeDocId(`jito-bundle-${bundle && bundle.bundle_uuid || idx}-${Math.floor(now / 60000)}`);
        const profitLamports = toNumber(bundle && bundle.total_tips);
        const profitUsd = profitLamports ? Number((profitLamports / 1e9 * 150).toFixed(2)) : null; // Rough SOL->USD conversion
        
        return {
          docId,
          data: {
            hustle_id: docId,
            title: `Jito Bundle: ${bundle && bundle.bundle_uuid && bundle.bundle_uuid.slice(0, 8) || 'Unknown'} - ${profitLamports ? profitLamports / 1e9 : 0} SOL tips`,
            profit_usd: profitUsd,
            network: 'Solana',
            type: 'Arbitrage',
            risk_score: 'Benign',
            source_platform: 'Jito',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            explorer_url: bundle && bundle.bundle_uuid ? `https://explorer.solana.com/tx/${bundle.bundle_uuid}` : 'https://explorer.solana.com',
            bundle_uuid: bundle && bundle.bundle_uuid,
            tips_lamports: profitLamports
          }
        };
      });
      
      return hustles.filter(h => h && h.docId);
    } catch (bundleError) {
      console.error(' [JITO] Bundle fetch failed:', bundleError);
      // Return tip accounts fallback
      const now = Date.now();
      const docId = safeDocId(`jito-tips-${Math.floor(now / 60000)}`);
      return [{
        docId,
        data: {
          hustle_id: docId,
          title: `Jito Tip Accounts: ${tipAccounts.length} active`,
          profit_usd: null,
          network: 'Solana',
          type: 'Arbitrage',
          risk_score: 'Benign',
          source_platform: 'Jito',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          explorer_url: 'https://explorer.solana.com',
          tip_accounts_count: tipAccounts.length
        }
      }];
    }
  } catch (e) {
    console.error(' [JITO] Jito fetch error:', e);
    return [];
  }
}

async function fetchEigenPhiLeaderboard() {
  console.log(' [EIGENPHI] Starting EigenPhi leaderboard fetch...');
  try {
    const url = (functions.config() && functions.config().eigenphi && functions.config().eigenphi.leaderboard_url) || 'https://www.eigenphi.io/mev/leaderboard';
    console.log(' [EIGENPHI] Using URL:', url);
    
    const html = await fetchHtml(url, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    
    console.log(' [EIGENPHI] HTML fetched, length:', html && html.length || 0);
    
    const $ = cheerio.load(html);
    const results = [];
    
    // Look for strategy patterns in the HTML
    const strategyPatterns = [
      /sandwich/i,
      /arbitrage/i,
      /liquidation/i,
      /sandwich.*\$(\d+,\d+)/i,
      /arbitrage.*\$(\d+,\d+)/i,
      /profit.*\$(\d+,\d+)/i
    ];
    
    $('*').each((_, el) => {
      const text = ($(el).text() || '').replace(/\s+/g, ' ').trim();
      if (text.length > 20 && text.length < 200) {
        for (const pattern of strategyPatterns) {
          if (pattern.test(text)) {
            results.push({
              text: text,
              element: el.name,
              matched: pattern.toString()
            });
            break;
          }
        }
      }
    });
    
    console.log(' [EIGENPHI] Found', results.length, 'potential strategy entries');
    
    if (results.length === 0) {
      // Create a fallback entry
      const now = Date.now();
      const docId = safeDocId(`eigenphi-fallback-${Math.floor(now / 3600000)}`);
      return [{
        docId,
        data: {
          hustle_id: docId,
          title: 'EigenPhi MEV Leaderboard - Monitoring Active Strategies',
          profit_usd: null,
          network: 'Ethereum',
          type: 'Arbitrage',
          risk_score: 'Benign',
          source_platform: 'EigenPhi',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          explorer_url: url,
          status: 'No public strategies found'
        }
      }];
    }
    
    const hustles = results.slice(0, 5).map((result, idx) => {
      const now = Date.now();
      const docId = safeDocId(`eigenphi-${Math.floor(now / 3600000)}-${idx}`);
      
      // Extract profit if available
      const profitMatch = result.text.match(/\$(\d+,\d+)/);
      const profitUsd = profitMatch ? parseFloat(profitMatch[1].replace(/,/g, '')) : null;
      
      // Determine strategy type
      let type = 'Arbitrage';
      if (result.text.toLowerCase().includes('sandwich')) type = 'Sandwich';
      else if (result.text.toLowerCase().includes('liquidation')) type = 'Liquidation';
      
      return {
        docId,
        data: {
          hustle_id: docId,
          title: `EigenPhi: ${result.text.slice(0, 120)}`,
          profit_usd: profitUsd,
          network: 'Ethereum',
          type: type,
          risk_score: 'Benign',
          source_platform: 'EigenPhi',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          explorer_url: url,
          strategy_element: result.element,
          matched_pattern: result.matched
        }
      };
    });
    
    return hustles.filter(h => h && h.docId);
  } catch (e) {
    console.error(' [EIGENPHI] EigenPhi fetch error:', e);
    return [];
  }
}

async function writeMevHustlesBatch(hustles) {
  const db = admin.firestore();
  const col = db.collection('mev_hustles');
  const batch = db.batch();

  let count = 0;
  for (const h of hustles) {
    if (!h || !h.docId || !h.data) continue;
    batch.set(col.doc(h.docId), h.data, { merge: true });
    count++;
  }

  if (count > 0) await batch.commit();
  return count;
}

async function pruneOldMevHustles() {
  const db = admin.firestore();
  const col = db.collection('mev_hustles');
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

  let deleted = 0;
  while (true) {
    const snap = await col.where('timestamp', '<', cutoff).orderBy('timestamp', 'asc').limit(250).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
  }

  return deleted;
}

async function writeMevHealth(health) {
  const db = admin.firestore();
  const docRef = db.collection('mev_health').doc('latest');
  await docRef.set({
    ...(health || {}),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function inferNetwork(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('solana')) return 'Solana';
  if (t.includes('arbitrum') || t.includes('optimism') || t.includes('layer 2') || t.includes('l2')) return 'Layer 2';
  if (t.includes('ethereum') || t.includes('eth')) return 'Ethereum';
  return 'Ethereum';
}

function twoSentenceSummary(title, source) {
  const safeTitle = (title || '').toString().trim() || 'This project';
  const safeSource = (source || '').toString().trim() || 'a source';
  return `${safeTitle} is trending in the airdrop/retroactive rewards ecosystem (via ${safeSource}). Review eligibility and complete the listed tasks to maximize potential upside.`;
}

async function fetchAirDropAlertRss() {
  const parser = new Parser({ timeout: 15000 });
  const feedUrl = (functions.config() && functions.config().airdropalert && functions.config().airdropalert.rss_url) || 'https://airdropalert.com/feed/';

  try {
    const feed = await parser.parseURL(feedUrl);
    const items = feed && feed.items && Array.isArray(feed.items) ? feed.items : [];

    return items
      .slice(0, 25)
      .map((item) => {
        const title = (item && item.title) ? item.title.toString().trim() : '';
        const link = item && item.link ? item.link : '';
        const description = (item && (item.contentSnippet || item.content)) ? item.contentSnippet || item.content : '';
        const finalDescription = (description && description.length > 20) ? description : twoSentenceSummary(title, 'AirDropAlert');

        return {
          title,
          description: finalDescription,
          source: 'AirDropAlert',
          link,
          tier: 'Gold',
          network: inferNetwork(title)
        };
      })
      .filter((x) => x.title && x.link);
  } catch (error) {
    console.error('Error fetching AirDropAlert RSS:', error);
    return [];
  }
}

async function fetchDefiLlamaPotentialRetroactive() {
  try {
    const response = await axios.get('https://api.llama.fi/protocols', {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CryptoExplorerBot/1.0; +https://cryptoexplorer.local)'
      }
    });
    const protocols = response && response.data && Array.isArray(response.data) ? response.data : [];

    return protocols
      .filter((p) => p && p.tvl && p.tvl > 1000000 && (p.token === null || typeof p.token === 'undefined'))
      .slice(0, 50)
      .map((p) => {
        const title = (p && p.name) ? p.name.toString().trim() : '';
        const link = p && p.url ? p.url : (p && p.slug ? `https://defillama.com/protocol/${p.slug}` : 'https://defillama.com');
        return {
          title,
          description: twoSentenceSummary(title, 'DeFiLlama'),
          source: 'DeFiLlama',
          link,
          tier: 'Gold',
          network: inferNetwork(`${title} ${p.chain || ''}`)
        };
      })
      .filter((x) => x.title && x.link);
  } catch (error) {
    console.error('Error fetching DeFiLlama protocols:', error);
    return [];
  }
}

async function fetchHtml(url, { userAgent } = {}) {
  const headers = {};
  if (userAgent) headers['User-Agent'] = userAgent;
  const resp = await axios.get(url, { timeout: 20000, headers });
  return resp.data;
}

async function scrapeAirdropBobLatest() {
  const url = 'https://airdropbob.com/';
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const results = [];

    $('section:contains("Latest") a').each((_, el) => {
      const title = ($(el).text() || '').trim();
      const href = $(el).attr('href');
      if (!title || !href) return;
      const link = href.startsWith('http') ? href : new URL(href, url).toString();
      results.push({
        title,
        description: twoSentenceSummary(title, 'AirdropBob'),
        source: 'AirdropBob',
        link,
        tier: 'Gold',
        network: inferNetwork(title)
      });
    });

    const dedup = new Map();
    for (const r of results) {
      const key = slugify(r.title);
      if (key && !dedup.has(key)) dedup.set(key, r);
    }
    return Array.from(dedup.values()).slice(0, 25);
  } catch (error) {
    console.error('Error scraping AirdropBob:', error);
    return [];
  }
}

async function scrapeFreeAirdropGrid() {
  const url = 'https://freeairdrop.io/';
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const results = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const title = ($(el).text() || '').trim();
      if (!href || !title) return;
      if (title.length < 2) return;
      if (!href.includes('airdrop') && !href.includes('project') && !href.includes('freeairdrop.io')) return;
      const link = href.startsWith('http') ? href : new URL(href, url).toString();
      results.push({
        title,
        description: twoSentenceSummary(title, 'Freeairdrop.io'),
        source: 'Freeairdrop.io',
        link,
        tier: 'Gold',
        network: inferNetwork(title)
      });
    });

    const dedup = new Map();
    for (const r of results) {
      const key = slugify(r.title);
      if (key && !dedup.has(key)) dedup.set(key, r);
    }
    return Array.from(dedup.values()).slice(0, 25);
  } catch (error) {
    console.error('Error scraping Freeairdrop.io:', error);
    return [];
  }
}

async function scrapeAirdropsIoLatest() {
  const url = 'https://airdrops.io/';
  try {
    const html = await fetchHtml(url, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const $ = cheerio.load(html);
    const results = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const title = ($(el).text() || '').trim();
      if (!href || !title) return;
      if (!href.includes('/airdrops/') && !href.includes('/latest')) return;
      const link = href.startsWith('http') ? href : new URL(href, url).toString();
      results.push({
        title,
        description: twoSentenceSummary(title, 'Airdrops.io'),
        source: 'Airdrops.io',
        link,
        tier: 'Gold',
        network: inferNetwork(title)
      });
    });

    const dedup = new Map();
    for (const r of results) {
      const key = slugify(r.title);
      if (key && !dedup.has(key)) dedup.set(key, r);
    }
    return Array.from(dedup.values()).slice(0, 25);
  } catch (error) {
    console.error('Error scraping Airdrops.io:', error);
    return [];
  }
}

async function saveToFirestore(items) {
  const db = admin.firestore();
  const col = db.collection('hustles_v2');

  const writes = items
    .filter((i) => i && i.title && i.link)
    .map((i) => {
      const docId = slugify(i.title);
      if (!docId) return null;
      return col.doc(docId).set({
        title: i.title,
        description: i.description || twoSentenceSummary(i.title, i.source),
        source: i.source || 'Unknown',
        link: i.link,
        tier: i.tier || 'Gold',
        date_added: admin.firestore.FieldValue.serverTimestamp(),
        network: i.network || inferNetwork(i.title)
      }, { merge: true });
    })
    .filter(Boolean);

  await Promise.allSettled(writes);
  return writes.length;
}

exports.fetchDailyAirdrops = functions.pubsub
  .schedule('every 12 hours')
  .timeZone('UTC')
  .onRun(async () => {
    const [rssItems, llamaItems, bobItems, freeItems, ioItems] = await Promise.all([
      fetchAirDropAlertRss(),
      fetchDefiLlamaPotentialRetroactive(),
      scrapeAirdropBobLatest(),
      scrapeFreeAirdropGrid(),
      scrapeAirdropsIoLatest()
    ]);

    const all = [...rssItems, ...llamaItems, ...bobItems, ...freeItems, ...ioItems];
    const unique = new Map();
    for (const item of all) {
      const key = slugify(item && item.title ? item.title : '');
      if (!key) continue;
      if (!unique.has(key)) unique.set(key, item);
    }

    const savedCount = await saveToFirestore(Array.from(unique.values()));
    console.log(`fetchDailyAirdrops collected=${all.length} unique=${unique.size} saved=${savedCount}`);
    return null;
  });

exports.syncMevHustles = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    const startedAt = Date.now();
    console.log('🚀 [MEV SYNC] Starting MEV sync at:', new Date().toISOString());
    console.log('🚀 [MEV SYNC] Context timestamp:', context.timestamp);
    
    try {
      console.log('🚀 [MEV SYNC] Fetching all data sources...');
      const [flashbotsBlocks, ethUsd, solUsd, mevWatchPayload, jitoHustles, eigenphiHustles] = await Promise.all([
        fetchFlashbotsBlocks(),
        fetchEthUsd(),
        fetchSolUsd(),
        fetchMevWatchHealth(),
        fetchJitoTips(),
        fetchEigenPhiLeaderboard()
      ]);

      console.log('🚀 [MEV SYNC] Data fetched:');
      console.log('  - Flashbots blocks:', flashbotsBlocks.length);
      console.log('  - ETH price:', ethUsd);
      console.log('  - SOL price:', solUsd);
      console.log('  - MEV watch health:', mevWatchPayload ? 'Available' : 'None');
      console.log('  - Jito hustles:', jitoHustles.length);
      console.log('  - EigenPhi hustles:', eigenphiHustles.length);

      const flashbotsHustles = buildFlashbotsHustles(flashbotsBlocks, ethUsd);
      console.log('🚀 [MEV SYNC] Built Flashbots hustles:', flashbotsHustles.length);
      
      const all = [...flashbotsHustles, ...jitoHustles, ...eigenphiHustles];
      console.log('🚀 [MEV SYNC] Total hustles before dedup:', all.length);

      const dedup = new Map();
      for (const h of all) {
        if (!h || !h.docId) continue;
        if (!dedup.has(h.docId)) dedup.set(h.docId, h);
      }

      const unique = Array.from(dedup.values());
      console.log('🚀 [MEV SYNC] Unique hustles after dedup:', unique.length);

      // Risk scoring for Ethereum transactions
      console.log('🚀 [MEV SYNC] Starting risk scoring...');
      const maxRiskChecks = Math.min(unique.length, 20);
      let riskScored = 0;
      
      for (let i = 0; i < maxRiskChecks; i++) {
        const h = unique[i];
        if (h && h.data && h.data.network !== 'Ethereum') continue;
        if (h && h.data && h.data.risk_score) continue;
        
        const txHash = (h && h.data && h.data.transaction_hash) || (h && h.data && h.data.hustle_id) || (h && h.docId);
        console.log(`🚀 [MEV SYNC] Checking risk for tx: ${txHash && txHash.slice ? txHash.slice(0, 10) : 'unknown'}...`);
        
        const risk = await fetchZeroMevRisk(txHash);
        if (risk) {
          h.data.risk_score = risk;
          riskScored++;
          console.log(`🚀 [MEV SYNC] Risk scored: ${risk}`);
        }
      }
      console.log('🚀 [MEV SYNC] Risk scoring completed:', riskScored, 'transactions scored');

      console.log('🚀 [MEV SYNC] Writing hustles to Firestore...');
      const saved = await writeMevHustlesBatch(unique);
      console.log('🚀 [MEV SYNC] Hustles saved to Firestore:', saved);

      console.log('🚀 [MEV SYNC] Writing health data...');
      const normHealth = normalizeMevWatchHealth(mevWatchPayload);
      await writeMevHealth({
        ...(normHealth || {}),
        source_url: mevWatchPayload && mevWatchPayload.url ? mevWatchPayload.url : null,
        eth_usd: ethUsd,
        sol_usd: solUsd,
        last_sync: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('🚀 [MEV SYNC] Pruning old data...');
      const pruned = await pruneOldMevHustles();
      console.log('🚀 [MEV SYNC] Old hustles pruned:', pruned);
      
      const duration = Date.now() - startedAt;
      console.log(`🚀 [MEV SYNC] Sync completed in ${duration}ms`);
      console.log(`🚀 [MEV SYNC] Summary: saved=${saved} pruned=${pruned} flashbots=${flashbotsHustles.length} jito=${jitoHustles.length} eigenphi=${eigenphiHustles.length} risk_scored=${riskScored}`);
      
      return null;
    } catch (error) {
      console.error('🚀 [MEV SYNC] CRITICAL ERROR:', error);
      console.error('🚀 [MEV SYNC] Error stack:', error.stack);
      
      // Write error status to health collection
      try {
        await writeMevHealth({
          status: 'Error',
          error_message: error.message,
          error_timestamp: admin.firestore.FieldValue.serverTimestamp(),
          sync_duration_ms: Date.now() - startedAt
        });
      } catch (healthError) {
        console.error('🚀 [MEV SYNC] Failed to write error status:', healthError);
      }
      
      return null;
    }
  });
