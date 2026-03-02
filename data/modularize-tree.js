const fs = require('fs');
const path = require('path');

const DATA_DIR = __dirname;
const BRANCHES_DIR = path.join(DATA_DIR, 'branches');
const DESCRIPTIONS_DIR = path.join(DATA_DIR, 'descriptions');
const CRYPTO_TREE_PATH = path.join(DATA_DIR, 'cryptoTree.json');

// Ensure directories exist
if (!fs.existsSync(BRANCHES_DIR)) fs.mkdirSync(BRANCHES_DIR, { recursive: true });
if (!fs.existsSync(DESCRIPTIONS_DIR)) fs.mkdirSync(DESCRIPTIONS_DIR, { recursive: true });

// Read the main cryptoTree.json
const cryptoTree = JSON.parse(fs.readFileSync(CRYPTO_TREE_PATH, 'utf8'));

// Store branch references and description mappings
const branchFiles = [];
const descriptionIndex = {};

/**
 * Sanitize a string to be used as a filename
 */
function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9-_]/gi, '_').toLowerCase().substring(0, 50);
}

/**
 * Recursively collect all tiles that have descriptions and generate description files
 */
function processTileForDescription(tile, branchId, categoryPath = []) {
  const currentPath = [...categoryPath, tile.id];
  const pathStr = currentPath.join(' > ');
  
  // If tile has a description, create a description file
  if (tile.description && tile.description.trim().length > 0 && tile.description.length > 3) {
    const descFilename = `${sanitizeFilename(branchId)}_${sanitizeFilename(tile.id)}.md`;
    const descFilePath = path.join(DESCRIPTIONS_DIR, descFilename);
    
    // Create description file content
    const descContent = `# ${tile.name}\n\n**ID:** ${tile.id}\n**Path:** ${pathStr}\n\n## Description\n\n${tile.description}\n\n## Tags\n\n${(tile.tags || []).map(tag => `- ${tag}`).join('\n')}\n`;
    
    fs.writeFileSync(descFilePath, descContent);
    
    // Store reference in index
    descriptionIndex[tile.id] = {
      file: `descriptions/${descFilename}`,
      name: tile.name,
      path: pathStr
    };
    
    // Replace description with reference in the tile
    tile.descriptionRef = `descriptions/${descFilename}`;
  }
  
  // Process nested structures
  if (tile.categories) tile.categories.forEach(c => processTileForDescription(c, branchId, currentPath));
  if (tile.subcategories) tile.subcategories.forEach(sc => processTileForDescription(sc, branchId, currentPath));
  if (tile.nodes) tile.nodes.forEach(n => processTileForDescription(n, branchId, currentPath));
  if (tile.subnodes) tile.subnodes.forEach(sn => processTileForDescription(sn, branchId, currentPath));
  if (tile.leafnodes) tile.leafnodes.forEach(ln => processTileForDescription(ln, branchId, currentPath));
}

/**
 * Remove original descriptions from a tile (keep only refs)
 */
function removeDescriptions(tile) {
  if (tile.descriptionRef) {
    delete tile.description;
  }
  
  if (tile.categories) tile.categories.forEach(removeDescriptions);
  if (tile.subcategories) tile.subcategories.forEach(removeDescriptions);
  if (tile.nodes) tile.nodes.forEach(removeDescriptions);
  if (tile.subnodes) tile.subnodes.forEach(removeDescriptions);
  if (tile.leafnodes) tile.leafnodes.forEach(removeDescriptions);
}

/**
 * Keep descriptions in the tile (for branch files that need full data)
 */
function keepDescriptions(tile) {
  // If we have a descriptionRef, restore the description for the branch file
  if (tile.descriptionRef && descriptionIndex[tile.id]) {
    const descFilePath = path.join(DATA_DIR, tile.descriptionRef);
    if (fs.existsSync(descFilePath)) {
      const content = fs.readFileSync(descFilePath, 'utf8');
      const descMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n\n##|$)/);
      if (descMatch) {
        tile.description = descMatch[1].trim();
      }
    }
  }
  
  if (tile.categories) tile.categories.forEach(keepDescriptions);
  if (tile.subcategories) tile.subcategories.forEach(keepDescriptions);
  if (tile.nodes) tile.nodes.forEach(keepDescriptions);
  if (tile.subnodes) tile.subnodes.forEach(keepDescriptions);
  if (tile.leafnodes) tile.leafnodes.forEach(keepDescriptions);
}

console.log('Processing branches...');

// Process each field (branch) in the cryptoTree
if (cryptoTree.fields && Array.isArray(cryptoTree.fields)) {
  cryptoTree.fields.forEach((field, index) => {
    const branchId = field.id;
    const branchFilename = `branch_${sanitizeFilename(branchId)}.json`;
    const branchPath = path.join(BRANCHES_DIR, branchFilename);
    
    console.log(`Processing branch ${index + 1}: ${field.name} (${branchId})`);
    
    // First pass: generate description files
    processTileForDescription(field, branchId);
    
    // Second pass: remove descriptions from the tile (for the trunk version)
    const fieldForTrunk = JSON.parse(JSON.stringify(field));
    removeDescriptions(fieldForTrunk);
    
    // Third pass: keep descriptions for branch file
    const fieldForBranch = JSON.parse(JSON.stringify(field));
    keepDescriptions(fieldForBranch);
    
    // Write the full branch file
    fs.writeFileSync(branchPath, JSON.stringify(fieldForBranch, null, 2));
    
    // Store reference for trunk
    branchFiles.push({
      id: branchId,
      file: `branches/${branchFilename}`,
      name: field.name,
      descriptionRef: fieldForTrunk.descriptionRef,
      _original: fieldForTrunk
    });
  });
}

// Create the new modular cryptoTree.json (trunk)
const trunkTree = {
  version: '2.0-modular',
  type: 'cryptoTree-trunk',
  fields: branchFiles.map(bf => ({
    id: bf.id,
    name: bf.name,
    file: bf.file,
    descriptionRef: bf.descriptionRef
  })),
  descriptionIndex: descriptionIndex
};

fs.writeFileSync(CRYPTO_TREE_PATH, JSON.stringify(trunkTree, null, 2));
console.log(`\nCreated trunk file: ${CRYPTO_TREE_PATH}`);
console.log(`Created ${branchFiles.length} branch files in ${BRANCHES_DIR}`);
console.log(`Created ${Object.keys(descriptionIndex).length} description files in ${DESCRIPTIONS_DIR}`);

// Save description index separately for easy access
fs.writeFileSync(
  path.join(DATA_DIR, 'descriptionIndex.json'),
  JSON.stringify(descriptionIndex, null, 2)
);

console.log('\nModular separation complete!');
console.log('- cryptoTree.json is now a trunk file referencing branch files');
console.log('- Each branch has its own file in data/branches/');
console.log('- Each tile has its own description file in data/descriptions/');
