const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

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

async function fetchDefiLlama() {
  try {
    const response = await axios.get('https://api.llama.fi/protocols');
    const protocols = response.data;
    return protocols
      .filter(p => p.category === 'DeFi' && p.tvl && p.tvl > 1000000)
      .map(p => ({
        id: slugify(p.name),
        name: p.name,
        source: 'DeFiLlama',
        type: 'protocol',
        addedAt: admin.firestore.Timestamp.now()
      }));
  } catch (error) {
    console.error('Error fetching DeFiLlama:', error);
    return [];
  }
}

async function fetchCoinMarketCap() {
  try {
    const apiKey = functions.config().coinmarketcap.key;
    if (!apiKey) {
      console.error('CoinMarketCap API key not configured');
      return [];
    }
    const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/airdrops', {
      headers: { 'X-CMC_PRO_API_KEY': apiKey }
    });
    const airdrops = response.data.data.slice(0, 5);
    return airdrops.map(a => ({
      id: slugify(a.name),
      name: a.name,
      source: 'CoinMarketCap',
      type: 'airdrop',
      addedAt: admin.firestore.Timestamp.now()
    }));
  } catch (error) {
    console.error('Error fetching CoinMarketCap:', error);
    return [];
  }
}

exports.syncAirdropFeed = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const defiItems = await fetchDefiLlama();
    const airdropItems = await fetchCoinMarketCap();
    const allItems = [...defiItems, ...airdropItems];

    const db = admin.firestore();
    const batch = db.batch();

    allItems.forEach(item => {
      const docRef = db.collection('global_hustles').doc(item.id);
      batch.set(docRef, item, { merge: true });
    });

    await batch.commit();
    console.log(`Synced ${allItems.length} items to global_hustles`);
    return null;
  });
