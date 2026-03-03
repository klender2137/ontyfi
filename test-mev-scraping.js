#!/usr/bin/env node

/**
 * Test script to verify MEV scraping functionality
 * Run this to test the Firebase Functions locally
 */

const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
const serviceAccount = require('./crypto-explorer-2137-firebase-adminsdk-fbsvc-0f3d6fb682.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testFlashbotsAPI() {
  console.log('🔥 Testing Flashbots API...');
  try {
    const response = await axios.get('https://blocks.flashbots.net/v1/blocks', {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CryptoExplorerBot/1.0)'
      }
    });
    
    console.log('✅ Flashbots API response:', response.status);
    console.log('📊 Data type:', typeof response.data);
    console.log('📊 Is array:', Array.isArray(response.data));
    console.log('📊 Length:', Array.isArray(response.data) ? response.data.length : 'N/A');
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      const sample = response.data[0];
      console.log('📊 Sample block keys:', Object.keys(sample));
      console.log('📊 Sample block_number:', sample.block_number);
      console.log('📊 Sample total_reward:', sample.total_reward);
      console.log('📊 Sample bundle_type:', sample.bundle_type);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Flashbots API error:', error.message);
    return null;
  }
}

async function testJitoAPI() {
  console.log('🔥 Testing Jito API...');
  try {
    const response = await axios.post('https://mainnet.block-engine.jito.wtf', {
      jsonrpc: '2.0',
      id: 1,
      method: 'get_tip_accounts',
      params: []
    }, {
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CryptoExplorer/1.0'
      }
    });
    
    console.log('✅ Jito API response:', response.status);
    console.log('📊 Tip accounts:', response.data?.result?.length || 0);
    
    return response.data;
  } catch (error) {
    console.error('❌ Jito API error:', error.message);
    return null;
  }
}

async function testEigenPhiAPI() {
  console.log('🔥 Testing EigenPhi API...');
  try {
    const response = await axios.get('https://www.eigenphi.io/mev/leaderboard', {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('✅ EigenPhi API response:', response.status);
    console.log('📊 HTML length:', response.data?.length || 0);
    
    // Look for MEV-related content
    const content = response.data || '';
    const hasSandwich = content.toLowerCase().includes('sandwich');
    const hasArbitrage = content.toLowerCase().includes('arbitrage');
    const hasProfit = content.toLowerCase().includes('profit');
    
    console.log('📊 Contains sandwich:', hasSandwich);
    console.log('📊 Contains arbitrage:', hasArbitrage);
    console.log('📊 Contains profit:', hasProfit);
    
    return response.data;
  } catch (error) {
    console.error('❌ EigenPhi API error:', error.message);
    return null;
  }
}

async function testFirestoreWrite() {
  console.log('🔥 Testing Firestore write...');
  try {
    const testDoc = {
      hustle_id: 'test-' + Date.now(),
      title: 'Test MEV Hustle',
      profit_usd: 123.45,
      network: 'Ethereum',
      type: 'Arbitrage',
      risk_score: 'Benign',
      source_platform: 'Test',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      explorer_url: 'https://etherscan.io'
    };
    
    const docRef = db.collection('mev_hustles').doc(testDoc.hustle_id);
    await docRef.set(testDoc);
    
    console.log('✅ Firestore write successful');
    console.log('📊 Document ID:', testDoc.hustle_id);
    
    // Clean up
    await docRef.delete();
    console.log('🧹 Test document cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Firestore write error:', error.message);
    return false;
  }
}

async function testPriceAPIs() {
  console.log('🔥 Testing price APIs...');
  
  try {
    // ETH price
    const ethResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      timeout: 10000
    });
    const ethPrice = ethResponse.data?.ethereum?.usd;
    console.log('✅ ETH price:', ethPrice);
    
    // SOL price
    const solResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      timeout: 10000
    });
    const solPrice = solResponse.data?.solana?.usd;
    console.log('✅ SOL price:', solPrice);
    
    return { ethPrice, solPrice };
  } catch (error) {
    console.error('❌ Price API error:', error.message);
    return null;
  }
}

async function checkExistingData() {
  console.log('🔥 Checking existing MEV data...');
  try {
    const snapshot = await db.collection('mev_hustles')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    console.log('📊 Existing MEV hustles:', snapshot.size);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📊 ${doc.id}: ${data.title} (${data.source_platform})`);
    });
    
    return snapshot.size;
  } catch (error) {
    console.error('❌ Data check error:', error.message);
    return 0;
  }
}

async function main() {
  console.log('🚀 Starting MEV scraping tests...\n');
  
  // Test all APIs
  const [flashbotsData, jitoData, eigenphiData, priceData, firestoreSuccess, existingCount] = await Promise.all([
    testFlashbotsAPI(),
    testJitoAPI(),
    testEigenPhiAPI(),
    testPriceAPIs(),
    testFirestoreWrite(),
    checkExistingData()
  ]);
  
  console.log('\n📊 TEST SUMMARY:');
  console.log('Flashbots API:', flashbotsData ? '✅ Working' : '❌ Failed');
  console.log('Jito API:', jitoData ? '✅ Working' : '❌ Failed');
  console.log('EigenPhi API:', eigenphiData ? '✅ Working' : '❌ Failed');
  console.log('Price APIs:', priceData ? '✅ Working' : '❌ Failed');
  console.log('Firestore Write:', firestoreSuccess ? '✅ Working' : '❌ Failed');
  console.log('Existing MEV hustles:', existingCount);
  
  console.log('\n🎯 NEXT STEPS:');
  if (flashbotsData && jitoData && eigenphiData && priceData && firestoreSuccess) {
    console.log('✅ All APIs working! Deploy Firebase Functions and check logs.');
  } else {
    console.log('❌ Some APIs failed. Check network connectivity and API availability.');
  }
  
  console.log('\n🔍 To debug Firebase Functions:');
  console.log('1. Deploy: firebase deploy --only functions');
  console.log('2. Check logs: firebase functions:log');
  console.log('3. Test manually: firebase functions:shell syncMevHustles');
  
  process.exit(0);
}

main().catch(console.error);
