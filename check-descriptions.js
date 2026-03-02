const treeService = require('./services/treeModular.service.js');
const tree = treeService.getFullTree();

function checkDescriptionRefs(node, path = []) {
  const currentPath = [...path, node.id];
  const results = [];
  
  if (node.descriptionRef) {
    const fs = require('fs');
    const descPath = require('path').join(__dirname, 'data', node.descriptionRef);
    const exists = fs.existsSync(descPath);
    
    results.push({
      nodeId: node.id,
      nodeName: node.name,
      descriptionRef: node.descriptionRef,
      fileExists: exists,
      path: currentPath.join(' > ')
    });
  }
  
  // Check child arrays
  const childArrays = ['categories', 'subcategories', 'nodes', 'subnodes', 'leafnodes', 'children'];
  for (const key of childArrays) {
    if (node[key] && Array.isArray(node[key])) {
      for (const child of node[key]) {
        results.push(...checkDescriptionRefs(child, currentPath));
      }
    }
  }
  
  return results;
}

const allRefs = [];
tree.fields.forEach(field => {
  allRefs.push(...checkDescriptionRefs(field));
});

console.log('=== DESCRIPTION REFERENCE ANALYSIS ===\n');

const validRefs = allRefs.filter(ref => ref.fileExists);
const invalidRefs = allRefs.filter(ref => !ref.fileExists);

console.log('TOTAL DESCRIPTION REFERENCES:', allRefs.length);
console.log('VALID REFERENCES:', validRefs.length);
console.log('INVALID REFERENCES:', invalidRefs.length);
console.log('');

if (validRefs.length > 0) {
  console.log('=== VALID DESCRIPTION REFERENCES (First 20) ===');
  validRefs.slice(0, 20).forEach((ref, i) => {
    console.log(`${i+1}. Node: ${ref.nodeId}`);
    console.log(`   Name: ${ref.nodeName}`);
    console.log(`   DescriptionRef: ${ref.descriptionRef}`);
    console.log(`   Path: ${ref.path}`);
    console.log('');
  });
  if (validRefs.length > 20) {
    console.log(`... and ${validRefs.length - 20} more valid references`);
  }
}

if (invalidRefs.length > 0) {
  console.log('=== INVALID DESCRIPTION REFERENCES ===');
  invalidRefs.forEach((ref, i) => {
    console.log(`${i+1}. Node: ${ref.nodeId}`);
    console.log(`   Name: ${ref.nodeName}`);
    console.log(`   DescriptionRef: ${ref.descriptionRef}`);
    console.log(`   Path: ${ref.path}`);
    console.log('');
  });
}
