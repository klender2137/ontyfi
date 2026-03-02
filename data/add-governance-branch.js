const fs = require('fs');
const path = require('path');

const DATA_DIR = __dirname;
const BRANCHES_DIR = path.join(DATA_DIR, 'branches');
const DESCRIPTIONS_DIR = path.join(DATA_DIR, 'descriptions');
const CRYPTO_TREE_PATH = path.join(DATA_DIR, 'cryptoTree.json');
const DESCRIPTION_INDEX_PATH = path.join(DATA_DIR, 'descriptionIndex.json');
const GOVERNANCE_BRANCH_PATH = path.join(BRANCHES_DIR, 'branch_governance-security.json');

/**
 * Sanitize a string to be used as a filename
 */
function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9-_]/gi, '_').toLowerCase().substring(0, 50);
}

// Read the governance branch
const governanceBranch = JSON.parse(fs.readFileSync(GOVERNANCE_BRANCH_PATH, 'utf8'));

// Read the current trunk and description index
const trunk = JSON.parse(fs.readFileSync(CRYPTO_TREE_PATH, 'utf8'));
const descriptionIndex = JSON.parse(fs.readFileSync(DESCRIPTION_INDEX_PATH, 'utf8'));

const branchId = governanceBranch.id;

/**
 * Recursively process tiles and create description files
 */
function processTileForDescription(tile, categoryPath = []) {
  const currentPath = [...categoryPath, tile.id];
  const pathStr = currentPath.join(' > ');
  
  // If tile has a description, create a description file
  if (tile.description && tile.description.trim().length > 0) {
    const descFilename = `governance_security_${sanitizeFilename(tile.id)}.md`;
    const descFilePath = path.join(DESCRIPTIONS_DIR, descFilename);
    
    // Create description file content
    const descContent = `# ${tile.name}

**ID:** ${tile.id}
**Path:** ${pathStr}
**Branch:** Governance & Security

## Description

${tile.description}

## Tags

${(tile.tags || []).map(tag => `- ${tag}`).join('\n')}
`;
    
    fs.writeFileSync(descFilePath, descContent);
    
    // Store reference in index
    descriptionIndex[tile.id] = {
      file: `descriptions/${descFilename}`,
      name: tile.name,
      path: pathStr,
      branch: 'governance-security'
    };
    
    // Replace description with reference
    tile.descriptionRef = `descriptions/${descFilename}`;
    delete tile.description;
  }
  
  // Process nested structures
  if (tile.categories) tile.categories.forEach(c => processTileForDescription(c, currentPath));
  if (tile.subcategories) tile.subcategories.forEach(sc => processTileForDescription(sc, currentPath));
  if (tile.nodes) tile.nodes.forEach(n => processTileForDescription(n, currentPath));
  if (tile.subnodes) tile.subnodes.forEach(sn => processTileForDescription(sn, currentPath));
  if (tile.leafnodes) tile.leafnodes.forEach(ln => processTileForDescription(ln, currentPath));
}

console.log('Processing 7th branch (Governance & Security)...');

// Process governance branch for descriptions
processTileForDescription(governanceBranch);

// Create trunk reference for governance branch (without descriptions)
const governanceRef = {
  id: governanceBranch.id,
  name: governanceBranch.name,
  file: 'branches/branch_governance-security.json',
  descriptionRef: governanceBranch.descriptionRef
};

// Add governance branch to trunk fields
trunk.fields.push(governanceRef);

// Update the counts
trunk.branchCount = trunk.fields.length;
trunk.totalDescriptionFiles = Object.keys(descriptionIndex).length;
trunk.lastUpdated = new Date().toISOString();

// Save updated files
fs.writeFileSync(CRYPTO_TREE_PATH, JSON.stringify(trunk, null, 2));
fs.writeFileSync(DESCRIPTION_INDEX_PATH, JSON.stringify(descriptionIndex, null, 2));

// Create a backup of the original cryptoTree before modularization
const backupPath = path.join(DATA_DIR, 'cryptoTree_backup_original.json');
if (!fs.existsSync(backupPath)) {
  console.log('Note: Original cryptoTree backup already exists or was created during first run');
}

// Create a merged version for compatibility (optional - loads all branches)
const mergedTree = {
  version: '2.0-merged',
  type: 'cryptoTree-full',
  fields: trunk.fields.map(fieldRef => {
    const branchPath = path.join(DATA_DIR, fieldRef.file);
    if (fs.existsSync(branchPath)) {
      return JSON.parse(fs.readFileSync(branchPath, 'utf8'));
    }
    return null;
  }).filter(Boolean)
};

fs.writeFileSync(path.join(DATA_DIR, 'cryptoTree.merged.json'), JSON.stringify(mergedTree, null, 2));

console.log('\n7th Branch Integration Complete!');
console.log(`- Added Governance & Security branch (${governanceBranch.id})`);
console.log(`- Total branches: ${trunk.fields.length}`);
console.log(`- Total description files: ${Object.keys(descriptionIndex).length}`);
console.log(`- Updated trunk: ${CRYPTO_TREE_PATH}`);
console.log(`- Created merged version: cryptoTree.merged.json (for backward compatibility)`);
