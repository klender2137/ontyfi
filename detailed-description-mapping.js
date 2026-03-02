const treeService = require('./services/treeModular.service.js');
const tree = treeService.getFullTree();

function analyzeField(field) {
  const refs = [];
  
  function collectRefs(node, path = []) {
    const currentPath = [...path, node.id];
    
    if (node.descriptionRef) {
      const fs = require('fs');
      const descPath = require('path').join(__dirname, 'data', node.descriptionRef);
      const exists = fs.existsSync(descPath);
      
      refs.push({
        nodeId: node.id,
        nodeName: node.name,
        descriptionRef: node.descriptionRef,
        fileExists: exists,
        path: currentPath.join(' > '),
        level: currentPath.length - 1
      });
    }
    
    // Check child arrays
    const childArrays = ['categories', 'subcategories', 'nodes', 'subnodes', 'leafnodes', 'children'];
    for (const key of childArrays) {
      if (node[key] && Array.isArray(node[key])) {
        for (const child of node[key]) {
          collectRefs(child, currentPath);
        }
      }
    }
  }
  
  collectRefs(field);
  return refs;
}

console.log('=== TILE-TO-DESCRIPTION MAPPING ANALYSIS ===\n');

tree.fields.forEach(field => {
  console.log(`## FIELD: ${field.name} (${field.id})`);
  console.log('');
  
  const refs = analyzeField(field);
  const validRefs = refs.filter(ref => ref.fileExists);
  const invalidRefs = refs.filter(ref => !ref.fileExists);
  
  console.log(`Total nodes with descriptionRef: ${refs.length}`);
  console.log(`Valid references: ${validRefs.length}`);
  console.log(`Invalid references: ${invalidRefs.length}`);
  console.log('');
  
  if (validRefs.length > 0) {
    console.log('### Valid Description References:');
    validRefs.forEach(ref => {
      const indent = '  '.repeat(ref.level);
      console.log(`${indent}✓ ${ref.nodeName} (${ref.nodeId})`);
      console.log(`${indent}  → ${ref.descriptionRef}`);
    });
    console.log('');
  }
  
  if (invalidRefs.length > 0) {
    console.log('### Invalid Description References:');
    invalidRefs.forEach(ref => {
      const indent = '  '.repeat(ref.level);
      console.log(`${indent}✗ ${ref.nodeName} (${ref.nodeId})`);
      console.log(`${indent}  → ${ref.descriptionRef} [FILE NOT FOUND]`);
    });
    console.log('');
  }
  
  console.log('---\n');
});

// Summary
const allRefs = [];
tree.fields.forEach(field => {
  allRefs.push(...analyzeField(field));
});

const totalValid = allRefs.filter(ref => ref.fileExists).length;
const totalInvalid = allRefs.filter(ref => !ref.fileExists).length;

console.log('## SUMMARY');
console.log(`Total description references across all fields: ${allRefs.length}`);
console.log(`Total valid references: ${totalValid}`);
console.log(`Total invalid references: ${totalInvalid}`);
console.log(`Success rate: ${((totalValid / allRefs.length) * 100).toFixed(1)}%`);
