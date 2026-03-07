import admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { readFileSync } from 'fs';
import { chromium } from 'playwright';

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

function cleanText(x) {
  return (x || '').toString().replace(/\s+/g, ' ').trim();
}

function toExternalLink(item) {
  return item?.external_link || item?.link || item?.explorer_url || null;
}

function toNormalizedHustleDoc(item) {
  const docId = item?.hustle_id || item?.tx_hash || item?.transaction_hash || slugify(item?.title || '');
  if (!docId) return null;

  const title = cleanText(item?.title || '');
  const external_link = toExternalLink(item);
  const source = item?.source || item?.source_platform || 'unknown';
  const category = item?.category || (item?.type && item.type.toString().toLowerCase().includes('mev') ? 'mev' : 'airdrop');
  const metrics = item?.metrics && typeof item.metrics === 'object'
    ? item.metrics
    : {
      profit: item?.profit_usd ? `$${item.profit_usd}` : (item?.profit || null),
      tvl: item?.tvl || null,
      action: item?.action || null
    };

  const content = cleanText(item?.content || item?.description || '');
  const description = cleanText(item?.description || item?.content || '') || twoSentenceSummary(title, source);

  return {
    docId,
    data: {
      hustle_id: docId,
      category,
      source,
      title,
      metrics,
      content,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      external_link,

      description,
      source_platform: source,
      link: external_link,
      explorer_url: external_link,
      tier: item?.tier || 'Gold',
      date_added: admin.firestore.FieldValue.serverTimestamp(),
      network: item?.network || inferNetwork(title),
      type: item?.type || 'Airdrop'
    }
  };
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

async function withBrowser(fn) {
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  try {
    return await fn({ browser, context, page });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function trySelectByVisibleLabel(page, labelText, optionText) {
  const label = page.locator('label', { hasText: labelText }).first();
  if (await label.count()) {
    const forId = await label.getAttribute('for');
    if (forId) {
      const select = page.locator(`#${forId}`);
      if (await select.count()) {
        await select.selectOption({ label: optionText }).catch(() => {});
        return true;
      }
    }
  }

  const selects = page.locator('select');
  const n = await selects.count();
  for (let i = 0; i < n; i++) {
    const s = selects.nth(i);
    const id = await s.getAttribute('id');
    if (!id) continue;
    const related = page.locator(`label[for="${id}"]`);
    if (await related.count()) {
      const text = cleanText(await related.first().innerText());
      if (text.toLowerCase().includes(labelText.toLowerCase())) {
        await s.selectOption({ label: optionText }).catch(() => {});
        return true;
      }
    }
  }

  return false;
}

async function clickDropdownOption(page, dropdownLabelText, optionText) {
  const root = page.locator('text=' + dropdownLabelText).first();
  if (await root.count()) {
    await root.click({ timeout: 15000 }).catch(() => {});
  }

  const option = page.locator('role=option', { hasText: optionText }).first();
  if (await option.count()) {
    await option.click({ timeout: 15000 }).catch(() => {});
    return true;
  }

  const byText = page.locator('text=' + optionText).first();
  if (await byText.count()) {
    await byText.click({ timeout: 15000 }).catch(() => {});
    return true;
  }

  return false;
}

async function scrapeAirdropAlertBrowseDefiOpenNewest() {
  const start = nowMs();
  const url = 'https://airdropalert.com/browse-airdrops/';

  try {
    const items = await withBrowser(async ({ page }) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);

      const sortOk = await trySelectByVisibleLabel(page, 'Sort', 'Newest first');
      if (!sortOk) {
        await clickDropdownOption(page, 'Sort', 'Newest first');
      }

      const catOk = await trySelectByVisibleLabel(page, 'Categories', 'DeFi');
      if (!catOk) {
        await clickDropdownOption(page, 'Categories', 'DeFi');
      }

      const statusOk = await trySelectByVisibleLabel(page, 'Status', 'Open');
      if (!statusOk) {
        await clickDropdownOption(page, 'Status', 'Open');
      }

      const searchBtn = page.getByRole('button', { name: /search/i }).first();
      if (await searchBtn.count()) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}),
          searchBtn.click({ timeout: 15000 }).catch(() => {})
        ]);
      }

      await page.waitForTimeout(1500);

      const blocks = await page.locator('article, .airdrop, .airdrop-item, .airdrop-card, .block').all();
      if (blocks.length === 0) {
        await page.waitForSelector('body', { timeout: 15000 });
      }

      const data = await page.evaluate(() => {
        const clean = (s) => (s || '').toString().replace(/\s+/g, ' ').trim();
        const els = Array.from(document.querySelectorAll('article, .airdrop, .airdrop-item, .airdrop-card, .block'));
        const out = [];

        for (const el of els) {
          const text = clean(el.innerText);
          if (!text || text.length < 20) continue;

          const titleEl = el.querySelector('h1,h2,h3,h4,.title,.card-title');
          const title = clean(titleEl ? titleEl.textContent : '');
          if (!title || title.length < 2) continue;

          const statusEl = el.querySelector('.status,.tag,.badge');
          const status = clean(statusEl ? statusEl.textContent : '');

          const actionGuess = (() => {
            const lines = text.split('\n').map(clean).filter(Boolean);
            const candidates = lines.filter((l) => l.length > 6 && l.length < 120);
            const picked = candidates.find((l) => /\b(stake|lend|bridge|swap|deploy|testnet|mint|complete|join)\b/i.test(l));
            return picked || '';
          })();

          const descGuess = (() => {
            const ps = Array.from(el.querySelectorAll('p')).map(p => clean(p.textContent)).filter(Boolean);
            if (ps.length) return ps.join(' ');
            const lines = text.split('\n').map(clean).filter(Boolean);
            const long = lines.find((l) => l.length >= 40);
            return long || '';
          })();

          const linkEl = el.querySelector('a[href]');
          const href = linkEl ? linkEl.getAttribute('href') : '';
          const link = href && href.startsWith('http') ? href : (href ? new URL(href, location.origin).toString() : '');

          out.push({ title, status, action: actionGuess, description: descGuess, link });
        }

        return out;
      });

      return data;
    });

    const out = items
      .map((x) => {
        const title = cleanText(x?.title);
        const status = cleanText(x?.status);
        const action = cleanText(x?.action);
        const description = cleanText(x?.description);
        const link = cleanText(x?.link);

        if (!title) return null;

        const hustle_id = slugify(title);

        return {
          hustle_id,
          category: 'airdrop',
          source: 'airdropalert',
          title,
          metrics: {
            action: action || null
          },
          content: description,
          description: description || twoSentenceSummary(title, 'AirdropAlert'),
          status: status || null,
          link,
          external_link: link,
          tier: 'Gold',
          network: inferNetwork(title),
          type: 'Airdrop'
        };
      })
      .filter(Boolean);

    const dedup = new Map();
    for (const r of out) {
      if (r?.hustle_id && !dedup.has(r.hustle_id)) dedup.set(r.hustle_id, r);
    }

    const finalOut = Array.from(dedup.values()).slice(0, 25);
    log('airdropalert.browse', `items=${finalOut.length} in ${msSince(start)}ms`);
    return finalOut;
  } catch (error) {
    logError('airdropalert.browse_error', error);
    return [];
  }
}

async function scrapeAirdropsIoDeepNewest() {
  const start = nowMs();
  const url = 'https://airdrops.io/';

  try {
    const items = await withBrowser(async ({ page }) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);

      const sortOk = await trySelectByVisibleLabel(page, 'Sort', 'Newest');
      if (!sortOk) {
        await clickDropdownOption(page, 'Sort', 'Newest');
      }

      await page.waitForTimeout(1500);

      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const out = [];
        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          if (!href.includes('/airdrops/')) continue;
          const url = href.startsWith('http') ? href : new URL(href, location.origin).toString();
          out.push(url);
        }
        return Array.from(new Set(out));
      });

      const detailLinks = links.slice(0, 15);
      const out = [];

      for (const link of detailLinks) {
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1000);

        const data = await page.evaluate(() => {
          const clean = (s) => (s || '').toString().replace(/\s+/g, ' ').trim();
          const title = clean(document.querySelector('h1')?.textContent || '');

          const headings = Array.from(document.querySelectorAll('h2,h3,h4'));
          const target = headings.find((h) => /step-by-step guide|how to participate|participate|guide/i.test(h.textContent || ''));
          const sectionText = (() => {
            if (!target) return '';
            const container = target.closest('section, article, div') || target.parentElement;
            if (!container) return '';
            const ps = Array.from(container.querySelectorAll('p,li')).map((x) => clean(x.textContent)).filter(Boolean);
            const joined = ps.join('\n');
            return joined;
          })();

          const fallback = (() => {
            const main = document.querySelector('main') || document.body;
            const text = clean(main?.innerText || '');
            return text.length > 400 ? text.slice(0, 2000) : text;
          })();

          return { title, content: sectionText || fallback };
        });

        if (!data?.title) continue;
        out.push({
          title: data.title,
          content: data.content,
          link
        });
      }

      return out;
    });

    const out = items
      .map((x) => {
        const title = cleanText(x?.title);
        const content = cleanText(x?.content);
        const link = cleanText(x?.link);
        if (!title) return null;
        const hustle_id = slugify(title);

        return {
          hustle_id,
          category: 'airdrop',
          source: 'airdropsio',
          title,
          metrics: {
            action: null
          },
          content,
          description: content || twoSentenceSummary(title, 'Airdrops.io'),
          link,
          external_link: link,
          tier: 'Gold',
          network: inferNetwork(title),
          type: 'Airdrop'
        };
      })
      .filter(Boolean);

    const dedup = new Map();
    for (const r of out) {
      if (r?.hustle_id && !dedup.has(r.hustle_id)) dedup.set(r.hustle_id, r);
    }

    const finalOut = Array.from(dedup.values()).slice(0, 25);
    log('airdropsio.deep', `items=${finalOut.length} in ${msSince(start)}ms`);
    return finalOut;
  } catch (error) {
    logError('airdropsio.deep_error', error);
    return [];
  }
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
  const docs = items
    .filter((i) => i && i.title)
    .map((i) => toNormalizedHustleDoc(i))
    .filter(Boolean);

  const writes = docs.map((d) => col.doc(d.docId).set(d.data, { merge: true }));

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
    const [rssItems, bobItems, freeItems, ioItems, alertBrowseItems, ioDeepItems] = await Promise.all([
      fetchAirDropAlertRss(),
      scrapeAirdropBobLatest(),
      scrapeFreeAirdropGrid(),
      scrapeAirdropsIoLatest(),
      scrapeAirdropAlertBrowseDefiOpenNewest(),
      scrapeAirdropsIoDeepNewest()
    ]);

    console.log('[Airdrop Scraper] Preview airdropalert.browse first3:', alertBrowseItems.slice(0, 3));
    console.log('[Airdrop Scraper] Preview airdropsio.deep first3:', ioDeepItems.slice(0, 3));

    const all = [...rssItems, ...bobItems, ...freeItems, ...ioItems, ...alertBrowseItems, ...ioDeepItems];
    const unique = new Map();
    for (const item of all) {
      const key = item?.hustle_id || slugify(item && item.title ? item.title : '');
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
