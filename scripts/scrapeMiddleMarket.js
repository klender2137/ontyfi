import admin from 'firebase-admin';
import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import { chromium } from 'playwright';

function log(stage, details = '') {
  const ts = new Date().toISOString();
  const msg = details ? ` ${details}` : '';
  console.log(`[MiddleMarket Scraper][${ts}][${stage}]${msg}`);
}

function logError(stage, err) {
  const ts = new Date().toISOString();
  const parts = [];
  if (err?.message) parts.push(err.message);
  if (err?.code) parts.push(`code=${err.code}`);
  if (err?.response?.status) parts.push(`status=${err.response.status}`);
  console.error(`[MiddleMarket Scraper][${ts}][${stage}]`, parts.join(' | ') || err);
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

function cleanText(x) {
  return (x || '').toString().replace(/\s+/g, ' ').trim();
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

function extractArticleFromHtml(html) {
  const $ = cheerio.load(html);

  const title = cleanText($('h1').first().text());

  const publishedTime =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="pubdate"]').attr('content') ||
    $('meta[name="publish-date"]').attr('content') ||
    $('meta[name="date"]').attr('content') ||
    $('time[datetime]').first().attr('datetime') ||
    '';

  const imageUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('article img').first().attr('src') ||
    '';

  const candidates = [
    $('.article-body').first(),
    $('.entry-content').first(),
    $('article').first(),
    $('.article__body').first()
  ].filter((x) => x && x.length);

  const root = candidates.length ? candidates[0] : $('body');

  const cloned = root.clone();

  cloned.find('script, style, nav, header, footer, aside, form').remove();
  cloned.find('[class*="related"], [class*="more"], [class*="recommended"], [id*="related"], [id*="more"], [id*="recommended"]').remove();

  cloned.find('*').each((_, el) => {
    const t = cleanText($(el).text());
    if (!t) return;
    const lowered = t.toLowerCase();
    if (lowered === 'more from' || lowered.startsWith('more from ')) {
      $(el).remove();
    }
    if (lowered === 'related' || lowered.startsWith('related ')) {
      $(el).remove();
    }
  });

  const content = cleanText(cloned.text());

  return {
    title,
    content,
    publishedTime: publishedTime || null,
    imageUrl: imageUrl || null
  };
}

async function scrapeMiddleMarket() {
  const url = 'https://www.themiddlemarket.com/sector/financial-services';
  const start = Date.now();

  log('run.start', `url=${url}`);

  const results = await withBrowser(async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    const trendingLinks = await page.evaluate(() => {
      function absUrl(href) {
        if (!href) return null;
        if (href.startsWith('http')) return href;
        try {
          return new URL(href, window.location.origin).toString();
        } catch {
          return null;
        }
      }

      const textMatchesTrending = (el) => {
        const t = (el && el.textContent ? el.textContent : '').trim().toLowerCase();
        return t === 'trending' || t.includes('trending');
      };

      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,strong,div,span'))
        .filter((el) => textMatchesTrending(el));

      let links = [];

      for (const h of headings) {
        const container = h.closest('aside, .sidebar, [class*="sidebar"], [class*="rail"], [class*="widget"], section, div') || h.parentElement;
        if (!container) continue;

        const inContainer = Array.from(container.querySelectorAll('a'))
          .map((a) => ({
            title: (a.textContent || '').trim(),
            url: absUrl(a.getAttribute('href') || a.href)
          }))
          .filter((x) => x.title && x.url);

        if (inContainer.length) {
          links = inContainer;
          break;
        }
      }

      if (!links.length) {
        links = Array.from(document.querySelectorAll('.trending-list a, .trending a, [class*="trending"] a'))
          .map((a) => ({
            title: (a.textContent || '').trim(),
            url: absUrl(a.getAttribute('href') || a.href)
          }))
          .filter((x) => x.title && x.url);
      }

      const dedup = new Map();
      for (const l of links) {
        if (!l?.url) continue;
        if (!dedup.has(l.url)) dedup.set(l.url, l);
      }

      return Array.from(dedup.values()).slice(0, 6);
    });

    log('trending.links', `count=${trendingLinks.length}`);

    const detailedInsights = [];

    for (const item of trendingLinks) {
      try {
        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(500);

        const html = await page.content();
        const extracted = extractArticleFromHtml(html);

        detailedInsights.push({
          title: extracted.title || item.title,
          content: extracted.content,
          publication_date: extracted.publishedTime,
          image_url: extracted.imageUrl,
          external_link: item.url,
          category: 'Financial Services',
          source: 'The Middle Market',
          type: 'Insight'
        });

        log('article.ok', `title=${(extracted.title || item.title || '').slice(0, 60)}`);
      } catch (e) {
        logError('article.fail', e);
        console.error(`Failed to scrape article: ${item.url}`);
      }
    }

    return detailedInsights;
  });

  const filtered = results
    .map((x) => ({
      title: cleanText(x?.title || ''),
      content: cleanText(x?.content || ''),
      publication_date: x?.publication_date || null,
      image_url: x?.image_url || null,
      external_link: x?.external_link || null,
      category: 'Financial Services',
      source: 'The Middle Market',
      type: 'Insight'
    }))
    .filter((x) => x.title && x.content);

  if (!filtered.length) {
    log('run.done', `durationMs=${Date.now() - start} saved=0 (no valid items)`);
    return;
  }

  await saveToInsights(filtered);
  log('run.done', `durationMs=${Date.now() - start} scraped=${results.length} saved=${filtered.length}`);
}

async function saveToInsights(items) {
  const db = initFirestore();
  const col = db.collection('insights_v1');

  const writes = items.map((item) => {
    const docId = slugify(item.title);
    return col.doc(docId).set({
      docId,
      category: 'Financial Services',
      source: 'The Middle Market',
      type: 'Insight',
      title: item.title,
      content: item.content,
      external_link: item.external_link || null,
      publication_date: item.publication_date || null,
      image_url: item.image_url || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  const settled = await Promise.allSettled(writes);
  const ok = settled.filter((r) => r.status === 'fulfilled').length;
  log('firestore.write', `ok=${ok}/${writes.length}`);
}

async function main() {
  const overallDeadlineMs = 4 * 60 * 1000;
  await withDeadline(scrapeMiddleMarket(), overallDeadlineMs, 'overall');
}

main().catch((err) => {
  logError('fatal', err);
  process.exitCode = 1;
});
