import admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';

// 1. DEFILLAMA LOGIC
async function getDefiLlamaYields() {
    // API: https://yields.llama.fi/pools
    const { data } = await axios.get('https://yields.llama.fi/pools');
    
    const pools = Array.isArray(data?.data) ? data.data : [];

    const BLUE_CHIP_PROTOCOLS = new Set([
        'aave',
        'curve',
        'compound'
    ]);

    return pools
        .filter(p => typeof p?.tvlUsd === 'number' && p.tvlUsd > 1000000)
        .sort((a, b) => (b?.tvlUsd ?? 0) - (a?.tvlUsd ?? 0))
        .slice(0, 200)
        .sort((a, b) => (b?.apy ?? -Infinity) - (a?.apy ?? -Infinity))
        .map(p => {
            const project = (p?.project ?? '').toString();
            const projectKey = project.trim().toLowerCase();
            const stablecoin = p?.stablecoin === true;
            const ilRisk = (p?.ilRisk ?? '').toString().toLowerCase();
            const bluechip = BLUE_CHIP_PROTOCOLS.has(projectKey);

            const safety_score = (stablecoin && ilRisk === 'no' && bluechip) ? 'High' : 'Low';

            return {
                poolId: (p?.pool ?? '').toString(),
                protocol: project,
                chain: (p?.chain ?? '').toString(),
                symbol: (p?.symbol ?? '').toString(),
                tvlUsd: p?.tvlUsd ?? null,
                apy: typeof p?.apy === 'number' ? p.apy : null,
                link: p?.pool ? `https://defillama.com/yields/pool/${p.pool}` : null,
                safety_score,
                stablecoin,
                ilRisk: p?.ilRisk ?? null,
                raw: p
            };
        });
}

// 2. COINDIX SCRAPER
async function getCoindixYields() {
    const { data: html } = await axios.get('https://www.coindix.com/', {
        timeout: 30000,
        validateStatus: s => s >= 200 && s < 300,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });
    const $ = cheerio.load(html);
    const top10 = [];

    const table = $('table').first();
    table.find('tr').slice(1, 11).each((i, el) => {
        const tds = $(el).find('td');
        const protocol = tds.eq(1).text().trim();
        const chain = tds.eq(2).text().trim();
        const tvl = tds.eq(3).text().trim();
        const apy = tds.eq(4).text().trim();
        const href = $(el).find('a').attr('href');
        const link = href
            ? (href.startsWith('http') ? href : `https://www.coindix.com${href}`)
            : null;

        top10.push({
            protocol,
            chain,
            tvl,
            apy,
            link
        });
    });
    return top10;
}

// 3. MAIN RUNNER
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
        throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${e?.message || String(e)}`);
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

function safeDocId(id) {
    const s = (id || '').toString().trim();
    if (!s) return null;
    return s.replace(/\//g, '_');
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
    }

    return { written, total: docs.length };
}

async function run() {
    const db = initFirestore();

    const [llama, coindix] = await Promise.all([
        getDefiLlamaYields(),
        getCoindixYields()
    ]);

    const now = new Date();

    const llamaDocs = llama
        .map((p) => {
            const docId = safeDocId(p.poolId);
            if (!docId) return null;
            return {
                docId,
                data: {
                    type: 'yield_llama',
                    protocol: p.protocol,
                    chain: p.chain,
                    symbol: p.symbol,
                    tvlUsd: p.tvlUsd,
                    apy: p.apy,
                    link: p.link,
                    safety_score: p.safety_score,
                    stablecoin: p.stablecoin,
                    ilRisk: p.ilRisk,
                    fetchedAt: now,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    raw: p.raw
                }
            };
        })
        .filter(Boolean);

    const coindixDocs = coindix
        .map((r) => {
            const key = `${(r?.protocol || '').toString().trim()}_${(r?.chain || '').toString().trim()}`;
            const docId = safeDocId(key);
            if (!docId) return null;
            return {
                docId,
                data: {
                    type: 'yield_coindix',
                    protocol: r.protocol,
                    chain: r.chain,
                    tvl: r.tvl,
                    apy: r.apy,
                    link: r.link,
                    fetchedAt: now,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }
            };
        })
        .filter(Boolean);

    const llamaWrite = await saveToHustlesV2(db, llamaDocs);
    const coindixWrite = await saveToHustlesV2(db, coindixDocs);

    console.log('[Yield Scraper] DefiLlama write summary:', llamaWrite);
    console.log('[Yield Scraper] Coindix write summary:', coindixWrite);
}

run().catch((err) => {
    console.error('[Yield Scraper] Fatal error:', err);
    process.exitCode = 1;
});