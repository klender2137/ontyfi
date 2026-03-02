const express = require('express');
const treeRoutes = require('./routes/tree.routes');

const app = express();
app.use(express.json());

// Mount API routes
app.use('/api', treeRoutes);

// Static files
app.use(express.static('.'));

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working' });
});

const server = app.listen(3005, () => {
  console.log('=== DESCRIPTION DISPLAY FIX TEST ===');
  console.log('Server running on http://localhost:3005');
  
  const http = require('http');
  
  // Test 1: Basic server
  http.get('http://localhost:3005/test', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('✅ Test 1 - Server working:', JSON.parse(data).message);
      
      // Test 2: API endpoint
      http.get('http://localhost:3005/api/tree', (res) => {
        let treeData = '';
        res.on('data', chunk => treeData += chunk);
        res.on('end', () => {
          try {
            const tree = JSON.parse(treeData);
            const firstField = tree.fields?.[0];
            console.log('✅ Test 2 - API working');
            console.log('- Fields count:', tree.fields?.length || 0);
            console.log('- First field:', firstField?.name);
            console.log('- Has description:', !!firstField?.description);
            console.log('- Description length:', firstField?.description?.length || 0);
            
            if (firstField?.description) {
              console.log('✅ DESCRIPTIONS ARE WORKING IN API');
              console.log('🔧 Now checking TreeScreen component...');
              
              // Check TreeScreen component
              const treeScreenCode = require('fs').readFileSync('./public/TreeScreen.js', 'utf8');
              const hasDescriptionLogic = treeScreenCode.includes('node.description') && treeScreenCode.includes('tree-section-description');
              console.log('- TreeScreen has description logic:', hasDescriptionLogic);
              
              if (hasDescriptionLogic) {
                console.log('✅ TreeScreen SHOULD display descriptions');
                console.log('🔍 ISSUE: Check if tree prop is passed correctly');
              } else {
                console.log('❌ TreeScreen missing description logic');
              }
            } else {
              console.log('❌ DESCRIPTIONS MISSING FROM API');
            }
            
            setTimeout(() => server.close(), 1000);
          } catch (error) {
            console.log('❌ API Error:', error.message);
            server.close();
          }
        });
      }).on('error', () => {
        console.log('❌ API endpoint failed');
        server.close();
      });
    });
  }).on('error', () => {
    console.log('❌ Server failed to start');
    server.close();
  });
});
