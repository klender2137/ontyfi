// Test if TreeScreen component correctly displays descriptions
console.log('=== TREESCREEN DESCRIPTION DISPLAY TEST ===');

// Read TreeScreen component
const fs = require('fs');
// temporarily suppress verbose logs from tree.services when loading data
const originalConsoleLog = console.log;
console.log = (...args) => {
  const msg = args[0] || '';
  if (typeof msg === 'string' && (msg.startsWith('Loaded description for') || msg.startsWith('Resolved description for') || msg.startsWith('Tree loaded with'))) {
    return;
  }
  originalConsoleLog(...args);
};

const treeScreenCode = fs.readFileSync('./public/TreeScreen.js', 'utf8');

// Check if TreeScreen has description display logic
const hasDescriptionLogic = treeScreenCode.includes('node.description') && 
                           treeScreenCode.includes('tree-section-description');

console.log('✅ TreeScreen has description logic:', hasDescriptionLogic);

// Check TreeTile component
const treeComponentsCode = fs.readFileSync('./public/tree-modules/tree-components.js', 'utf8');
const hasTileDescriptionLogic = treeComponentsCode.includes('node.description') && 
                               treeComponentsCode.includes('getShortDescription');

console.log('✅ TreeTile has description logic:', hasTileDescriptionLogic);

// Check the description handling logic
const descriptionHandling = treeComponentsCode.includes('let displayDescription = node.description') &&
                           treeComponentsCode.includes('if (!displayDescription && node.descriptionRef)');

console.log('✅ TreeTile has fallback handling:', descriptionHandling);

// Test the actual tree data
const treeService = require('./services/tree.services');
const tree = treeService.getFullTree();

console.log('\\n=== TREE DATA VERIFICATION ===');
const testNode = tree.fields[0];
console.log('Test node:', testNode.name);
console.log('Has description:', !!testNode.description);
console.log('Description length:', testNode.description?.length || 0);
console.log('Tags count:', testNode.tags?.length || 0);

// Simulate what TreeTile would do
const getShortDescription = (description) => {
  if (!description) return '';
  const cleanText = description.replace(/\s+/g, ' ').trim();
  const maxChars = 90;
  if (cleanText.length <= maxChars) return cleanText;
  return cleanText.substring(0, maxChars) + '...';
};

let displayDescription = testNode.description;
if (!displayDescription && testNode.descriptionRef) {
  const refName = testNode.descriptionRef.replace(/^.*\//, '').replace('.md', '').replace(/_/g, ' ');
  displayDescription = `Loading: ${refName}...`;
}

const shortDesc = getShortDescription(displayDescription);

console.log('\\n=== DISPLAY SIMULATION ===');
console.log('Would display:', shortDesc);
console.log('Display length:', shortDesc.length);

if (testNode.description && shortDesc && shortDesc !== 'Loading: ...') {
  console.log('✅ DESCRIPTIONS SHOULD DISPLAY CORRECTLY');
} else {
  console.log('❌ DESCRIPTIONS WILL NOT DISPLAY');
}

console.log('\\n=== CONCLUSION ===');
console.log('hasDescriptionLogic=', hasDescriptionLogic, 'hasTileDescriptionLogic=', hasTileDescriptionLogic, 'backendHasDesc=', !!testNode.description);
if (hasDescriptionLogic && hasTileDescriptionLogic && testNode.description) {
  console.log('✅ All components have description logic');
  console.log('✅ Backend is serving descriptions');
  console.log('✅ Frontend should display descriptions');
  console.log('🔍 ISSUE: Check if tree prop is passed to TreeScreen correctly');
} else {
  console.log('❌ Missing description logic in components');
}
// restore original console.log in case other modules rely on it
console.log = originalConsoleLog;

