import admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import { chromium } from 'playwright';

function log(stage, details = '') {
  const ts = new Date().toISOString();
  const msg = details ? ` ${details}` : '';
  console.log(`[MEV Scraper][${ts}][${stage}]${msg}`);
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
  console.error(`[MEV Scraper][${ts}][${stage}]`, parts.join(' | ') || err);
}

function nowMs() {
  return Date.now();
}

function msSince(start) {
  return Date.now() - start;
}

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON env var');
  }

  let parsed;
  try {
    // Support local runs where env var is a path to the JSON file
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
  const start = nowMs();
  const serviceAccount = getServiceAccountFromEnv();

  log('firebase.credentials', `project_id=${serviceAccount?.project_id || 'unknown'} client_email=${serviceAccount?.client_email || 'unknown'}`);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    log('firebase.init', 'initialized firebase-admin app');
  } else {
    log('firebase.init', 'firebase-admin app already initialized');
  }

  const db = admin.firestore();
  log('firestore.init', `ready in ${msSince(start)}ms`);
  return db;
}

function normalizeTxId(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;

  // EVM tx hashes are 32-byte hex prefixed with 0x
  if (/^0x[a-fA-F0-9]{64}$/.test(v)) return v;
  if (/^[a-fA-F0-9]{64}$/.test(v)) return `0x${v}`;

  // Non-EVM identifiers (e.g. Solana signatures) should not be rewritten.
  return v;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logResponsePreview(data) {
  try {
    console.log(JSON.stringify(data).slice(0, 100));
  } catch {
    console.log(String(data).slice(0, 100));
  }
}

async function fetchJson(url, config = {}) {
  const res = await axios.get(url, {
    timeout: 30000,
    validateStatus: s => s >= 200 && s < 300,
    headers: {
      'user-agent': 'CryptoExplorer-MEV-Scraper/1.0 (+https://github.com/)'
    },
    ...config
  });
  logResponsePreview(res.data);
  return res.data;
}

async function fetchHtml(url, config = {}) {
  const res = await axios.get(url, {
    timeout: 30000,
    validateStatus: s => s >= 200 && s < 300,
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    },
    ...config
  });
  logResponsePreview(res.data);
  return res.data;
}

async function tryUrls(urls, fetcher) {
  let lastErr = null;
  for (const url of urls) {
    try {
      log('http.try', url);
      return await fetcher(url);
    } catch (e) {
      logError('http.fail', e);
      lastErr = e;
    }
  }
  throw lastErr || new Error('All URLs failed');
}

function coerceToArray(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (typeof x === 'object') {
    if (Array.isArray(x.data)) return x.data;
    if (Array.isArray(x.result)) return x.result;
    if (Array.isArray(x.items)) return x.items;
  }
  return [];
}

function toNumber(x) {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string') {
    const v = Number(x.replace(/[$,\s]/g, ''));
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

function weiToEth(wei) {
  try {
    if (wei === null || wei === undefined) return null;
    const s = typeof wei === 'string' ? wei : String(wei);
    if (!/^\d+$/.test(s)) return null;
    const w = BigInt(s);
    const eth = Number(w) / 1e18;
    return Number.isFinite(eth) ? eth : null;
  } catch {
    return null;
  }
}

function safeDocId(id) {
  const s = (id || '').toString().trim();
  if (!s) return null;
  // Firestore doc id restrictions are lax, but avoid accidental slashes.
  return s.replace(/\//g, '_');
}

function cleanTokenSymbols(raw) {
  if (!raw) return [];
  const s = Array.isArray(raw) ? raw.join(' ') : String(raw);
  const parts = s
    .split(/[\s,|/]+/g)
    .map((x) => x.replace(/[^a-zA-Z0-9]/g, '').trim())
    .filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique;
}

async function withBrowser(fn) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'Europe/Berlin'
  });

  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    'accept-language': 'en-US,en;q=0.9'
  });

  try {
    return await fn({ browser, context, page });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function scrapeEigenPhiSandwich24hBrowser() {
  const start = nowMs();
  const url = 'https://eigenphi.io/mev/ethereum/sandwich';

  try {
    const rows = await withBrowser(async ({ page }) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1500);

      const btn24h = page.getByRole('button', { name: /^24h$/i }).first();
      if (await btn24h.count()) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}),
          btn24h.click({ timeout: 15000 }).catch(() => {})
        ]);
      } else {
        const byText = page.locator('text=24H').first();
        if (await byText.count()) {
          await Promise.all([
            page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}),
            byText.click({ timeout: 15000 }).catch(() => {})
          ]);
        }
      }

      // Dynamic table (often Ant Design). Wait until it renders.
      await page.waitForSelector('.ant-table, table, [role="table"]', { timeout: 60000 });
      await page.waitForTimeout(1500);

      const data = await page.evaluate(() => {
        const clean = (s) => (s || '').toString().replace(/\s+/g, ' ').trim();

        const extractTx = (node) => {
          const a = node.querySelector('a[href*="0x"], a[href*="/tx/"]');
          if (!a) return '';
          const href = a.getAttribute('href') || '';
          const m = href.match(/0x[a-fA-F0-9]{64}/);
          if (m) return m[0];
          const t = clean(a.textContent);
          const m2 = t.match(/0x[a-fA-F0-9]{64}/);
          return m2 ? m2[0] : '';
        };

        const root = document.querySelector('.ant-table') || document;
        const table = root.querySelector('table') || document.querySelector('table');
        if (!table) return [];

        const trs = Array.from(table.querySelectorAll('tbody tr'));
        const out = [];
        for (const tr of trs) {
          const tds = Array.from(tr.querySelectorAll('td'));
          const rowText = clean(tr.textContent);
          if (!rowText || rowText.length < 10) continue;

          const time = clean(tds[0]?.textContent || '');
          const tx_hash = extractTx(tr) || clean(tds[1]?.textContent || '');
          const tokens = clean(tds[2]?.textContent || '');
          const profit = clean(tds[3]?.textContent || '');
          const cost = clean(tds[4]?.textContent || '');
          const revenue = clean(tds[5]?.textContent || '');

          out.push({ time, tx_hash, tokens, profit, cost, revenue });
        }
        return out;
      });

      return data;
    });

    const out = rows
      .map((r) => {
        const tx = normalizeTxId(r?.tx_hash);
        if (!tx) return null;
        return {
          tx_hash: tx,
          time: r?.time || null,
          tokens: cleanTokenSymbols(r?.tokens),
          profit: r?.profit || null,
          cost: r?.cost || null,
          revenue: r?.revenue || null,
          timestamp: new Date(),
          raw: r
        };
      })
      .filter(Boolean);

    log('eigenphi.sandwich24h_browser', `rows=${out.length} in ${msSince(start)}ms`);
    return out;
  } catch (e) {
    logError('eigenphi.sandwich24h_browser_error', e);
    return [];
  }
}

async function scrapeFlashbots() {
  const start = nowMs();
  const url = 'https://relay-analytics.ultrasound.money/v1/data/bidtraces/proposer_payload_delivered';

  const data = await fetchJson(url, {
    params: { limit: 50 },
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });

  const rows = coerceToArray(data);
  log('flashbots.blocks', `received=${rows.length} in ${msSince(start)}ms`);

  const out = [];
  for (const r of rows) {
    let valueWei = null;
    try {
      if (r?.value !== null && r?.value !== undefined) {
        const s = typeof r.value === 'string' ? r.value : String(r.value);
        if (/^\d+$/.test(s)) valueWei = BigInt(s);
      }
    } catch {
      valueWei = null;
    }
    if (typeof valueWei !== 'bigint' || valueWei <= 100000000000000000n) continue;
    const valueEth = weiToEth(r?.value);
    const blockHash = normalizeTxId(r?.block_hash || r?.blockHash);
    if (!blockHash) continue;

    out.push({
      transaction_hash: blockHash,
      id_type: 'block_hash',
      source_platform: 'Flashbots/UltraSound',
      source: 'flashbots_ultrasound',
      type: 'Lucrative',
      category: 'Lucrative',
      network: 'Ethereum',
      title: `Flashbots/UltraSound Lucrative Block • ${String(r?.block_number ?? r?.blockNumber ?? '').toString()}`,
      profit_usd: null,
      value_eth: valueEth,
      block_number: r?.block_number ?? r?.blockNumber ?? null,
      builder_pubkey: r?.builder_pubkey ?? null,
      proposer_pubkey: r?.proposer_pubkey ?? null,
      timestamp: r?.timestamp ? new Date(r.timestamp) : new Date(),
      explorer_url: r?.block_number ? `https://etherscan.io/block/${r.block_number}` : null,
      raw: r
    });
  }

  return out;
}

async function scrapeEigenPhiSandwich24h() {
  const start = nowMs();
  const url = 'https://eigenphi.io/api/v1/mev/ethereum/sandwich?duration=24h';

  const data = await fetchJson(url, {
    headers: {
      'referer': 'https://eigenphi.io/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });

  const rows = coerceToArray(data?.data?.list) 
    .concat(coerceToArray(data?.data?.rows));

  const out = [];
  for (const r of rows) {
    const tx = normalizeTxId(r?.tx_hash || r?.transaction_hash || r?.hash || r?.txid);
    if (!tx) continue;
    const profit = toNumber(r?.profit_usd || r?.profit || r?.usd_profit);
    const tokens = r?.tokens || r?.token || r?.token_symbols || null;

    out.push({
      tx_hash: tx,
      profit_usd: profit,
      tokens,
      timestamp: new Date(),
      raw: r
    });
  }

  log('eigenphi.sandwich24h', `rows=${out.length} in ${msSince(start)}ms`);
  return out;
}

function extractZeroMevItems(payload) {
  const visited = new Set();

  function walk(node) {
    if (!node || (typeof node !== 'object' && !Array.isArray(node))) return null;
    if (visited.has(node)) return null;
    visited.add(node);

    if (Array.isArray(node)) {
      // sometimes mev is nested arrays
      const flattened = node.flat ? node.flat(Infinity) : node.reduce((acc, x) => acc.concat(x), []);
      const objs = flattened.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
      return objs.length ? objs : null;
    }

    if (Array.isArray(node.mev)) return walk(node.mev);
    if (node.data && Array.isArray(node.data.mev)) return walk(node.data.mev);

    for (const v of Object.values(node)) {
      const found = walk(v);
      if (found) return found;
    }
    return null;
  }

  return walk(payload) || [];
}

async function fetchZeroMevLatestBlock() {
  const start = nowMs();
  const url = 'https://api.zeromev.org/v1/block/latest';
  log('zeromev.try', url);

  const data = await fetchJson(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });

  const mev = extractZeroMevItems(data);
  const blockNumber = data?.block_number ?? data?.blockNumber ?? data?.data?.block_number ?? null;

  log('zeromev.latest', `block=${blockNumber ?? 'unknown'} mev_items=${mev.length} in ${msSince(start)}ms`);
  return { blockNumber, mev };
}

async function fetchUltraSoundBuilderStats() {
  const url = 'https://payload.ultrasound.money/api/v1/builder_stats';
  log('ultrasound.try', url);
  const data = await fetchJson(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  return data;
}

async function saveMarketHealth(db, health) {
  const ref = db.collection('mev_health').doc('latest');
  await ref.set(
    {
      ...health,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  const snap = await ref.get();
  log('firestore.mev_health', `wrote+read mev_health/latest exists=${snap.exists}`);
}

function toHustlesV2Docs(items) {
  // Convert different sources into hustles_v2 documents.
  // hustles_v2 is what your frontend listens to.
  return items.map((it) => {
    const docId = safeDocId(it.docId || it.tx_hash || it.transaction_hash);
    if (!docId) return null;

    const profit = typeof it.profit_usd === 'number' ? it.profit_usd : null;
    const lucrative = typeof profit === 'number' && profit > 10;

    const title = it.title || (it.source_platform
      ? `${it.source_platform} MEV Alpha`
      : 'MEV Alpha');

    const source = it.source || it.source_platform || 'MEV';
    const external_link = it.external_link || it.link || it.explorer_url || null;
    const tokens = cleanTokenSymbols(it.tokens);

    const metrics = {
      profit: it.profit || (typeof profit === 'number' ? `$${profit}` : null),
      cost: it.cost || null,
      revenue: it.revenue || null,
      tokens
    };

    const content = it.content || it.description || null;

    return {
      docId,
      data: {
        hustle_id: docId,
        category: 'mev',
        source: source.toString().toLowerCase().includes('eigenphi') ? 'eigenphi' : source,
        title,
        metrics,
        content,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        external_link,

        description: it.description || null,
        source_platform: it.source_platform || it.source || 'MEV',
        link: external_link,
        explorer_url: external_link,
        tier: it.tier || (lucrative ? 'Gold' : 'Silver'),
        network: it.network || 'Ethereum',
        type: it.type || (lucrative ? 'Lucrative' : 'MEV'),
        profit_usd: profit,
        risk_score: it.risk_score || null,
        date_added: admin.firestore.FieldValue.serverTimestamp(),
        tx_hash: it.tx_hash || it.transaction_hash || null,
        transaction_hash: it.tx_hash || it.transaction_hash || null,
        block_number: it.block_number ?? null,
        raw: it.raw || null
      }
    };
  }).filter(Boolean);
}

async function saveToHustlesV2(db, docs) {
  const col = db.collection('hustles_v2');
  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const d of chunk) {
      batch.set(col.doc(d.docId), d.data, { merge: true });
      written++;
    }
    await batch.commit();
    log('firestore.hustles_v2_commit', `chunk=${Math.floor(i / BATCH_SIZE) + 1} size=${chunk.length}`);
  }

  return { written, total: docs.length };
}

async function scrapeJito() {
  const start = nowMs();
  const baseUrl = 'https://mainnet.block-engine.jito.wtf/api/v1/bundles';

  try {
    log('jito.jsonrpc', `POST ${baseUrl}`);

    const headers = {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    const postOnce = async (body) => {
      const resp = await axios.post(
        baseUrl,
        body,
        { timeout: 30000, validateStatus: s => s >= 200 && s < 300, headers }
      );
      logResponsePreview(resp.data);
      return resp;
    };

    const postWithRetry = async (body) => {
      try {
        return await postOnce(body);
      } catch (e) {
        const status = e?.response?.status;
        if (status === 429) {
          await sleep(2000);
          try {
            return await postOnce(body);
          } catch (e2) {
            logError('jito.rate_limited', e2);
            return null;
          }
        }
        throw e;
      }
    };

    const tipAccountsResp = await postWithRetry({ jsonrpc: '2.0', id: 1, method: 'getTipAccounts', params: [] });
    const tipFloorResp = await postWithRetry({ jsonrpc: '2.0', id: 2, method: 'getTipFloor', params: [] });

    if (!tipAccountsResp || !tipFloorResp) {
      return [];
    }

    const tipFloor = tipFloorResp?.data?.result ?? null;
    log('jito.tip_floor', `value=${typeof tipFloor === 'string' || typeof tipFloor === 'number' ? String(tipFloor) : 'unknown'} in ${msSince(start)}ms`);

    return [{
      docId: `jito-tipfloor-${new Date().toISOString().slice(0, 16)}`,
      transaction_hash: `jito-tipfloor-${new Date().toISOString()}`,
      source_platform: 'Jito',
      network: 'Solana',
      type: 'Lucrative Opportunity',
      category: 'Lucrative Opportunity',
      title: 'Jito Tip Floor',
      description: `Tip floor indicator: ${typeof tipFloor === 'string' || typeof tipFloor === 'number' ? String(tipFloor) : 'unknown'}`,
      timestamp: new Date(),
      raw: {
        tipFloor: tipFloorResp?.data,
        tipAccounts: tipAccountsResp?.data
      }
    }];
  } catch (e) {
    logError('jito.unreachable', e);
    return [];
  }
}

async function scrapeMevBoostRelays() {
  const start = nowMs();
  const relays = [
    'https://relay.flashbots.net',
    'https://boost-relay.ultrasound.money',
    'https://agnostic-relay.net'
  ];

  const out = [];

  for (const base of relays) {
    const url = `${base}/relay/v1/data/bidtraces/proposer_payload_delivered`;
    try {
      log('mevboost.start', base);
      const data = await fetchJson(url, { params: { limit: 50 } });
      const rows = coerceToArray(data);
      log('mevboost.rows', `${base} received=${rows.length} in ${msSince(start)}ms`);

      for (const r of rows) {
        const blockHash = normalizeTxId(r?.block_hash || r?.blockHash);
        if (!blockHash) continue;

        // Relay data is payload/block-level; it does not include tx hashes.
        // We store with transaction_hash=block_hash but annotate id_type.
        out.push({
          transaction_hash: blockHash,
          id_type: 'block_hash',
          source: 'mevboost_relay',
          relay: base,
          slot: r?.slot ?? null,
          block_number: r?.block_number ?? r?.blockNumber ?? null,
          builder_pubkey: r?.builder_pubkey ?? null,
          proposer_pubkey: r?.proposer_pubkey ?? null,
          value: r?.value ?? null,
          num_tx: r?.num_tx ?? null,
          timestamp: r?.timestamp ? new Date(r.timestamp) : new Date(),
          raw: r
        });
      }
    } catch (e) {
      logError('mevboost.error', e);
    }
  }

  log('mevboost.done', `items=${out.length} in ${msSince(start)}ms`);
  return out;
}

async function scrapeEigenPhi() {
  const start = nowMs();
  const apiUrls = [
    'https://eigenphi.io/api/v1/mev/transactions',
    'https://eigenphi.io/api/v2/mev/transactions'
  ];

  try {
    const data = await tryUrls(apiUrls, url => fetchJson(url, { params: { limit: 50, page_size: 50 } }));
    const items = coerceToArray(data);

    log('eigenphi.api', `received=${items.length} in ${msSince(start)}ms`);

    if (items.length === 0) {
      throw new Error('EigenPhi API returned 0 items');
    }

    const out = [];
    for (const it of items) {
      const txHash = normalizeTxId(it?.transaction_hash || it?.transactionHash || it?.hash || it?.tx_hash || it?.txHash);
      if (!txHash) continue;
      const tsRaw = it?.timestamp ?? it?.time ?? it?.created_at ?? it?.createdAt;
      out.push({
        transaction_hash: txHash,
        source: 'eigenphi',
        chain: it?.chain ?? 'ethereum',
        timestamp: tsRaw ? new Date(tsRaw) : new Date(),
        raw: it
      });
    }

    return out;
  } catch (apiErr) {
    logError('eigenphi.api_failed', apiErr);
    const htmlUrls = [
      'https://eigenphi.io/mev',
      'https://eigenphi.io/'
    ];

    const html = await tryUrls(htmlUrls, async url => fetchHtml(url));

    const $ = cheerio.load(html);
    const out = [];

    const candidates = new Set();
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const match = href.match(/0x[a-fA-F0-9]{64}/);
      if (match) candidates.add(match[0]);
    });

    log('eigenphi.html', `candidates=${candidates.size} in ${msSince(start)}ms`);

    for (const txHash of candidates) {
      out.push({
        transaction_hash: txHash,
        source: 'eigenphi',
        timestamp: new Date(),
        raw: { discovered_from: 'html', url: 'https://eigenphi.io/mev' }
      });
    }

    return out;
  }
}

async function firestorePing(db) {
  const start = nowMs();
  const ref = db.collection('_mev_debug').doc('ping');
  await ref.set(
    {
      ok: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  // Read-after-write verification (helps diagnose “writes succeed but I don't see them”)
  const snap = await ref.get();
  log(
    'firestore.ping',
    `wrote+read _mev_debug/ping exists=${snap.exists} in ${msSince(start)}ms`
  );
}

async function writeRunSummary(db, runId, payload) {
  const ref = db.collection('mev_runs').doc(runId);
  await ref.set(
    {
      ...payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  // Deterministic marker doc for easy visibility in console
  await db.collection('mev_runs').doc('latest').set(
    {
      runId,
      status: payload?.status || 'unknown',
      clientUpdatedAt: new Date()
    },
    { merge: true }
  );

  // Read-after-write verification
  const snap = await ref.get();
  log('firestore.run_summary', `wrote+read mev_runs/${runId} exists=${snap.exists}`);
}

async function saveToFirestore(db, items) {
  const collection = db.collection('mev_transactions');

  const BATCH_SIZE = 400;
  let written = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const item of chunk) {
      const txHash = item.transaction_hash;
      if (!txHash) {
        skipped++;
        continue;
      }

      const docRef = collection.doc(txHash);
      batch.set(
        docRef,
        {
          ...item,
          updatedAt: new Date(),
          firstSeenAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      written++;
    }

    await batch.commit();
    log('firestore.batch_commit', `chunk=${Math.floor(i / BATCH_SIZE) + 1} size=${chunk.length}`);
  }

  return { written, skipped, total: items.length };
}

async function main() {
  const runStart = nowMs();
  const runId = `run_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  log('run.start', `id=${runId}`);

  const db = initFirestore();

  await writeRunSummary(db, runId, {
    status: 'started',
    startedAt: new Date(),
    env: {
      node: process.version
    }
  });

  await firestorePing(db);

  const results = {
    flashbots: { ok: false, count: 0, error: null },
    jito: { ok: false, count: 0, error: null },
    eigenphiSandwich24h: { ok: false, count: 0, error: null },
    zeromev: { ok: false, count: 0, error: null },
    ultrasound: { ok: false, count: 0, error: null }
  };

  const all = [];

  try {
    log('flashbots.start');
    const items = await scrapeFlashbots();
    results.flashbots.ok = true;
    results.flashbots.count = items.length;
    all.push(...items);
    log('flashbots.done', `items=${items.length}`);
  } catch (e) {
    results.flashbots.error = e?.message || String(e);
    logError('flashbots.error', e);
  }

  try {
    log('jito.start');
    const items = await scrapeJito();
    results.jito.ok = true;
    results.jito.count = items.length;
    all.push(...items);
    log('jito.done', `items=${items.length}`);
  } catch (e) {
    results.jito.error = e?.message || String(e);
    logError('jito.error', e);
  }

  // EigenPhi Sandwich 24h
  try {
    log('eigenphiSandwich24h.start');
    let rows = await scrapeEigenPhiSandwich24h();
    if (!rows || rows.length === 0) {
      log('eigenphiSandwich24h.fallback', 'API returned 0 rows; trying browser scrape');
      rows = await scrapeEigenPhiSandwich24hBrowser();
    }

    console.log('[MEV Scraper] Preview eigenphi.sandwich first3:', rows.slice(0, 3));

    results.eigenphiSandwich24h.ok = true;
    results.eigenphiSandwich24h.count = rows.length;
    for (const r of rows) {
      all.push({
        tx_hash: r.tx_hash,
        profit_usd: r.profit_usd,
        tokens: r.tokens,
        profit: r.profit || null,
        cost: r.cost || null,
        revenue: r.revenue || null,
        time: r.time || null,
        timestamp: r.timestamp,
        source_platform: 'EigenPhi',
        source: 'eigenphi',
        external_link: `https://eigenphi.io/mev/ethereum/sandwich`,
        type: 'Sandwich',
        network: 'Ethereum',
        title: `EigenPhi Sandwich • ${r.tx_hash.slice(0, 10)}…`,
        explorer_url: `https://etherscan.io/tx/${r.tx_hash}`
      });
    }
    log('eigenphiSandwich24h.done', `rows=${rows.length}`);
  } catch (e) {
    results.eigenphiSandwich24h.error = e?.message || String(e);
    logError('eigenphiSandwich24h.error', e);
  }

  // ZeroMEV latest block (sandwich/arbitrage only)
  try {
    log('zeromev.start');
    const { blockNumber, mev } = await fetchZeroMevLatestBlock();
    const filtered = mev.filter((m) => {
      const cls = (m?.classification || m?.mev_type || m?.type || '').toString().toLowerCase();
      return cls.includes('sandwich') || cls.includes('arbitrage');
    });

    results.zeromev.ok = true;
    results.zeromev.count = filtered.length;

    for (const it of filtered) {
      const tx = normalizeTxId(it?.tx_hash || it?.transaction_hash || it?.hash);
      if (!tx) continue;
      const profit = toNumber(it?.profit_usd || it?.profit || it?.usd_profit);
      const cls = (it?.classification || it?.mev_type || it?.type || 'MEV').toString();

      all.push({
        tx_hash: tx,
        profit_usd: profit,
        timestamp: new Date(),
        source_platform: 'ZeroMEV',
        type: cls,
        network: 'Ethereum',
        title: `ZeroMEV ${cls} • ${tx.slice(0, 10)}…`,
        explorer_url: `https://etherscan.io/tx/${tx}`,
        block_number: blockNumber ?? null,
        raw: it
      });
    }

    log('zeromev.done', `items=${filtered.length}`);
  } catch (e) {
    results.zeromev.error = e?.message || String(e);
    logError('zeromev.error', e);
  }

  // Ultra Sound Money builder metrics -> mev_health/latest
  try {
    log('ultrasound.start');
    const stats = await fetchUltraSoundBuilderStats();

    const tipsApr = toNumber(stats?.tips_apr ?? stats?.tipsApr ?? stats?.tips?.apr);
    const mevRewardDaily = toNumber(stats?.mev_reward_daily ?? stats?.mevRewardDaily ?? stats?.mev?.reward_daily);

    await saveMarketHealth(db, {
      status: typeof tipsApr === 'number' && tipsApr > 0.20 ? 'Elevated' : 'Open Market',
      tips_apr: tipsApr,
      mev_reward_daily: mevRewardDaily,
      source: 'ultrasound_builder_stats',
      timestamp: new Date(),
      raw: stats
    });

    results.ultrasound.ok = true;
    results.ultrasound.count = 1;
    log('ultrasound.done', `tips_apr=${tipsApr} mev_reward_daily=${mevRewardDaily}`);
  } catch (e) {
    results.ultrasound.error = e?.message || String(e);
    logError('ultrasound.error', e);
  }

  const deduped = new Map();
  for (const it of all) {
    const key = it?.tx_hash || it?.transaction_hash;
    if (!key) continue;
    if (!deduped.has(key)) deduped.set(key, it);
  }

  const uniqueItems = [...deduped.values()];

  log('run.parse_summary', `parsed=${all.length} unique=${uniqueItems.length}`);
  console.log('[MEV Scraper] Source results:', results);

  await writeRunSummary(db, runId, {
    status: 'scraped',
    durationMs: msSince(runStart),
    results,
    parsedCount: all.length,
    uniqueCount: uniqueItems.length
  });

  if (uniqueItems.length === 0) {
    log('run.no_items', 'exiting without Firestore writes');
    await writeRunSummary(db, runId, {
      status: 'completed_no_items',
      completedAt: new Date(),
      durationMs: msSince(runStart)
    });
    return;
  }

  // Save raw/relayed items to mev_transactions (debugging / analytics)
  const save = await saveToFirestore(db, uniqueItems.map((x) => ({
    transaction_hash: x.tx_hash || x.transaction_hash,
    source: x.source_platform || x.source,
    timestamp: x.timestamp,
    raw: x
  })));
  console.log('[MEV Scraper] Firestore write summary:', save);

  // Save user-facing feed items to hustles_v2 (frontend listens here)
  const hustleDocs = toHustlesV2Docs(uniqueItems);
  const hustleSave = await saveToHustlesV2(db, hustleDocs);
  console.log('[MEV Scraper] hustles_v2 write summary:', hustleSave);
  await writeRunSummary(db, runId, {
    status: 'completed',
    completedAt: new Date(),
    durationMs: msSince(runStart),
    firestore: save
  });
  log('run.done', `durationMs=${msSince(runStart)}`);
}

main().catch(err => {
  console.error('[MEV Scraper] Fatal error:', err);
  process.exitCode = 1;
});
