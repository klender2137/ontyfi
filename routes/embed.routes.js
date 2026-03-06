import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';

const router = express.Router();

function absolutizeUrl(base, href) {
  try {
    if (!href) return null;
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    if (href.startsWith('//')) return `https:${href}`;
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function sanitizeAndExtractEigenPhiSandwichTable(html) {
  const $ = cheerio.load(html);

  // Remove scripts entirely
  $('script').remove();

  // Remove inline event handlers for safety
  $('*').each((_, el) => {
    const attribs = el.attribs || {};
    for (const name of Object.keys(attribs)) {
      if (name.toLowerCase().startsWith('on')) {
        $(el).removeAttr(name);
      }
    }
  });

  // Fix links
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const abs = absolutizeUrl('https://eigenphi.io', href);
    if (abs) {
      $(el).attr('href', abs);
      $(el).attr('target', '_blank');
      $(el).attr('rel', 'noopener noreferrer');
    } else {
      // If no href, unwrap anchor content
      $(el).replaceWith($(el).text());
    }
  });

  // Attempt to locate the main table container (best-effort)
  let container = $('div.sandwich-table-container').first();
  if (!container.length) container = $('table').first().parent();
  if (!container.length) container = $('table').first();
  if (!container.length) container = $('main').first();

  const extracted = container.length ? container : $('<div></div>').text('EigenPhi table not found in fetched HTML.');

  // Wrap for scoping
  const wrapper = $('<div class="eigenphi-embed"></div>');
  wrapper.append(extracted.clone());

  return wrapper.html();
}

router.get('/eigenphi', async (req, res) => {
  try {
    const url = 'https://eigenphi.io/mev/ethereum/sandwich';
    const resp = await axios.get(url, {
      timeout: 30000,
      validateStatus: s => s >= 200 && s < 300,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const sanitized = sanitizeAndExtractEigenPhiSandwichTable(resp.data);
    res.status(200).type('text/html').send(sanitized);
  } catch (e) {
    res.status(502).json({
      success: false,
      error: 'Failed to fetch EigenPhi embed',
      details: e?.message || String(e)
    });
  }
});

export default router;
