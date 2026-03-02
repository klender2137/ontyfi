const express = require('express');
const treeRoutes = require('./routes/tree.routes');

const app = express();
app.use(express.json());
app.use('/api', treeRoutes);

app.listen(3006, () => {
  console.log('=== FINAL DESCRIPTION TEST ===');
  console.log('Server running on http://localhost:3006');
  
  const http = require('http');
  
  // Test API endpoint
  http.get('http://localhost:3006/api/tree', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const tree = JSON.parse(data);
        console.log('✅ API Test Results:');
        console.log('- Fields count:', tree.fields?.length || 0);
        
        const firstField = tree.fields?.[0];
        if (firstField) {
          console.log('- First field:', firstField.name);
          console.log('- Has description:', !!firstField.description);
          console.log('- Description length:', firstField.description?.length || 0);
          console.log('- Sample description:', firstField.description?.substring(0, 50) + '...');
        }
        
        // Test JSON file
        const fs = require('fs');
        const jsonData = JSON.parse(fs.readFileSync('./data/cryptoTree.json', 'utf8'));
        const jsonFirstField = jsonData.fields?.[0];
        
        console.log('\\n=== COMPARISON ===');
        console.log('JSON file has descriptions:', !!jsonFirstField?.description);
        console.log('API has descriptions:', !!firstField?.description);
        
        if (firstField?.description && !jsonFirstField?.description) {
          console.log('✅ API RESOLVES DESCRIPTIONS CORRECTLY');
          console.log('✅ TreeScreen WILL show descriptions when using API');
          console.log('❌ TreeScreen WILL NOT show descriptions when using JSON file');
          console.log('🔧 SOLUTION: Ensure API is used instead of JSON fallback');
        }
        
        setTimeout(() => process.exit(0), 1000);
      } catch (error) {
        console.log('❌ API Error:', error.message);
        process.exit(1);
      }
    });
  }).on('error', (err) => {
    console.log('❌ Server error:', err.message);
    process.exit(1);
  });
});
