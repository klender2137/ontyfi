import admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';

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

  const parsed = JSON.parse(raw);

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

function normalizeTxHash(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  return v.startsWith('0x') ? v : `0x${v}`;
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

async function scrapeFlashbots() {
  const start = nowMs();
  const urls = [
    'https://blocks.flashbots.net/v1/blocks?limit=50',
    'https://blocks.flashbots.net/v1/blocks'
  ];

  const data = await tryUrls(urls, url => fetchJson(url));
  const blocks = coerceToArray(data);

  log('flashbots.blocks', `received=${blocks.length} in ${msSince(start)}ms`);

  const out = [];
  for (const b of blocks) {
    const blockNumber = b?.block_number ?? b?.blockNumber ?? b?.number;
    const builder = b?.builder_pubkey ?? b?.builderPubkey ?? b?.builder;
    const ts = b?.timestamp ? new Date(b.timestamp * 1000) : new Date();

    const txs = coerceToArray(b?.transactions || b?.txs || b?.included_transactions);
    for (const t of txs) {
      const txHash = normalizeTxHash(t?.tx_hash || t?.txHash || t?.hash || t?.transaction_hash || t?.transactionHash);
      if (!txHash) continue;
      out.push({
        transaction_hash: txHash,
        source: 'flashbots',
        block_number: blockNumber ?? null,
        builder: builder ?? null,
        timestamp: ts,
        raw: t
      });
    }
  }

  return out;
}

async function scrapeJito() {
  const start = nowMs();
  const urls = [
    'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
    'https://block-engine.jito.wtf/api/v1/bundles',
    'https://explorer.jito.wtf/api/v1/bundles'
  ];

  const data = await tryUrls(urls, url => fetchJson(url, { params: { limit: 50 } }));
  const bundles = coerceToArray(data);

  log('jito.bundles', `received=${bundles.length} in ${msSince(start)}ms`);

  const out = [];
  for (const b of bundles) {
    const tsRaw = b?.timestamp ?? b?.time ?? b?.created_at ?? b?.createdAt;
    const ts = tsRaw ? new Date(tsRaw) : new Date();

    const txs = coerceToArray(b?.transactions || b?.txs || b?.bundle_transactions);
    for (const t of txs) {
      const txHash = normalizeTxHash(t?.transaction_hash || t?.transactionHash || t?.hash || t?.tx_hash || t?.txHash);
      if (!txHash) continue;
      out.push({
        transaction_hash: txHash,
        source: 'jito',
        bundle_id: b?.bundle_id ?? b?.bundleId ?? b?.id ?? null,
        timestamp: ts,
        raw: t
      });
    }
  }

  return out;
}

async function scrapeEigenPhi() {
  const start = nowMs();
  const apiUrls = [
    'https://eigenphi.io/api/v1/mev/transactions',
    'https://eigenphi.io/api/v2/mev/transactions'
  ];

  try {
    const data = await tryUrls(apiUrls, url => fetchJson(url, { params: { limit: 50 } }));
    const items = coerceToArray(data);

    log('eigenphi.api', `received=${items.length} in ${msSince(start)}ms`);

    const out = [];
    for (const it of items) {
      const txHash = normalizeTxHash(it?.transaction_hash || it?.transactionHash || it?.hash || it?.tx_hash || it?.txHash);
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

    const html = await tryUrls(htmlUrls, async url => {
      const res = await axios.get(url, { timeout: 30000, validateStatus: s => s >= 200 && s < 300 });
      return res.data;
    });

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
  log('firestore.ping', `wrote _mev_debug/ping in ${msSince(start)}ms`);
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
    eigenphi: { ok: false, count: 0, error: null }
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

  try {
    log('eigenphi.start');
    const items = await scrapeEigenPhi();
    results.eigenphi.ok = true;
    results.eigenphi.count = items.length;
    all.push(...items);
    log('eigenphi.done', `items=${items.length}`);
  } catch (e) {
    results.eigenphi.error = e?.message || String(e);
    logError('eigenphi.error', e);
  }

  const deduped = new Map();
  for (const it of all) {
    if (!it?.transaction_hash) continue;
    if (!deduped.has(it.transaction_hash)) deduped.set(it.transaction_hash, it);
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

  const save = await saveToFirestore(db, uniqueItems);
  console.log('[MEV Scraper] Firestore write summary:', save);
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
