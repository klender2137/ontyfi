import admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { readFileSync } from 'fs';

function log(stage, details = '') {
  const ts = new Date().toISOString();
  const msg = details ? ` ${details}` : '';
  console.log(`[Airdrop Scraper][${ts}][${stage}]${msg}`);
}

function logError(stage, err) {
  const ts = new Date().toISOString();
  const parts = [];
  if (err?.message) parts.push(err.message);
  if (err?.code) parts.push(`code=${err.code}`);
  if (err?.response?.status) parts.push(`status=${err.response.status}`);
  if (err?.response?.data) {
    try {
      const body = typeof err.response.data === 'string'
        ? err.response.data.slice(0, 500)
        : JSON.stringify(err.response.data).slice(0, 500);
      parts.push(`body=${body}`);
    } catch {
      parts.push('body=[unserializable]');
    }
  }
  console.error(`[Airdrop Scraper][${ts}][${stage}]`, parts.join(' | ') || err);
}

function nowMs() {
  return Date.now();
}

function msSince(start) {
  return Date.now() - start;
}

function withDeadline(promise, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Deadline exceeded: ${label} (${ms}ms)`)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON env var');
  }

  let parsed;
  try {
    const looksLikePath = /\.json\s*$/i.test(raw) && !raw.trim().startsWith('{');
    if (looksLikePath) {
      const jsonText = readFileSync(raw.trim(), 'utf8');
      parsed = JSON.parse(jsonText);
    } else {
      parsed = JSON.parse(raw);
    }
  } catch (e) {
    const hint = raw.trim().startsWith('{')
      ? 'Env var looks like JSON but could not be parsed.'
      : 'If you are running locally, set FIREBASE_SERVICE_ACCOUNT_JSON to the JSON *contents* or to a valid path ending in .json.';
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. ${hint} Original error: ${e?.message || String(e)}`);
  }

  if (parsed.private_key && typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed;
}

function initFirestore() {
  const serviceAccount = getServiceAccountFromEnv();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }

  return admin.firestore();
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

async function fetchHtml(url, { userAgent } = {}) {
  const resp = await axios.get(url, {
    timeout: 20000,
    validateStatus: s => s >= 200 && s < 300,
    headers: {
      'user-agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  console.log(JSON.stringify(resp.data).slice(0, 100));
  return resp.data;
}

async function fetchAirDropAlertRss() {
  const start = nowMs();
  const parser = new Parser({ timeout: 15000 });
  const feedUrl = 'https://airdropalert.com/feed/';

  try {
    const feed = await withDeadline(parser.parseURL(feedUrl), 25000, 'AirDropAlert RSS');
    const items = feed && feed.items && Array.isArray(feed.items) ? feed.items : [];

    const out = items
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

    log('airdropalert.rss', `items=${out.length} in ${msSince(start)}ms`);
    return out;
  } catch (error) {
    logError('airdropalert.rss_error', error);
    return [];
  }
}

async function scrapeAirdropBobLatest() {
  const start = nowMs();
  const url = 'https://airdropbob.com/';

  try {
    const html = await withDeadline(fetchHtml(url), 30000, 'AirdropBob HTML');
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

    const out = Array.from(dedup.values()).slice(0, 25);
    log('airdropbob.scrape', `items=${out.length} in ${msSince(start)}ms`);
    return out;
  } catch (error) {
    logError('airdropbob.scrape_error', error);
    return [];
  }
}

async function scrapeFreeAirdropGrid() {
  const start = nowMs();
  const url = 'https://freeairdrop.io/';

  try {
    const html = await withDeadline(fetchHtml(url), 30000, 'FreeAirdrop HTML');
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

    const out = Array.from(dedup.values()).slice(0, 25);
    log('freeairdrop.scrape', `items=${out.length} in ${msSince(start)}ms`);
    return out;
  } catch (error) {
    logError('freeairdrop.scrape_error', error);
    return [];
  }
}

async function scrapeAirdropsIoLatest() {
  const start = nowMs();
  const url = 'https://airdrops.io/';

  try {
    const html = await withDeadline(fetchHtml(url), 30000, 'Airdrops.io HTML');
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

    const out = Array.from(dedup.values()).slice(0, 25);
    log('airdropsio.scrape', `items=${out.length} in ${msSince(start)}ms`);
    return out;
  } catch (error) {
    logError('airdropsio.scrape_error', error);
    return [];
  }
}

async function saveToHustlesV2(db, items) {
  const col = db.collection('hustles_v2');
  const writes = items
    .filter((i) => i && i.title && i.link)
    .map((i) => {
      const docId = slugify(i.title);
      if (!docId) return null;
      return col.doc(docId).set({
        hustle_id: docId,
        title: i.title,
        description: i.description || twoSentenceSummary(i.title, i.source),
        source: i.source || 'Unknown',
        source_platform: i.source || 'Unknown',
        link: i.link,
        explorer_url: i.link,
        tier: i.tier || 'Gold',
        date_added: admin.firestore.FieldValue.serverTimestamp(),
        network: i.network || inferNetwork(i.title),
        type: 'Airdrop',
        category: 'Airdrop'
      }, { merge: true });
    })
    .filter(Boolean);

  const settled = await Promise.allSettled(writes);
  const ok = settled.filter((r) => r.status === 'fulfilled').length;
  return { attempted: writes.length, ok };
}

async function main() {
  const start = nowMs();
  const runId = `airdrop_run_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  log('run.start', `id=${runId}`);

  const overallDeadlineMs = 4 * 60 * 1000;

  const db = initFirestore();

  const scrapePromise = (async () => {
    const [rssItems, bobItems, freeItems, ioItems] = await Promise.all([
      fetchAirDropAlertRss(),
      scrapeAirdropBobLatest(),
      scrapeFreeAirdropGrid(),
      scrapeAirdropsIoLatest()
    ]);

    const all = [...rssItems, ...bobItems, ...freeItems, ...ioItems];
    const unique = new Map();
    for (const item of all) {
      const key = slugify(item && item.title ? item.title : '');
      if (!key) continue;
      if (!unique.has(key)) unique.set(key, item);
    }

    const uniqueItems = Array.from(unique.values());
    log('run.summary', `collected=${all.length} unique=${uniqueItems.length}`);

    if (uniqueItems.length === 0) {
      return { collected: all.length, unique: uniqueItems.length, saved: { attempted: 0, ok: 0 } };
    }

    const saved = await saveToHustlesV2(db, uniqueItems);
    return { collected: all.length, unique: uniqueItems.length, saved };
  })();

  const result = await withDeadline(scrapePromise, overallDeadlineMs, 'overall');
  log('run.done', `durationMs=${msSince(start)} collected=${result.collected} unique=${result.unique} saved_ok=${result.saved.ok}/${result.saved.attempted}`);
}

main().catch((err) => {
  logError('fatal', err);
  process.exitCode = 1;
});
