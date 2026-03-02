const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DESCRIPTIONS_DIR = path.join(DATA_DIR, 'descriptions');
const BRANCHES_DIR = path.join(DATA_DIR, 'branches');

// Get all description files
const descFiles = fs.readdirSync(DESCRIPTIONS_DIR).filter(f => f.endsWith('.md'));

for (const file of descFiles) {
  const content = fs.readFileSync(path.join(DESCRIPTIONS_DIR, file), 'utf8');
  const idMatch = content.match(/\*\*ID:\*\*\s+(.+)$/m);
  if (!idMatch) continue;
  const id = idMatch[1].trim();
  
  // Get branch name from file name, before first _
  const branchName = file.split('_')[0];
  const branchFile = `branch_${branchName}.json`;
  const branchPath = path.join(BRANCHES_DIR, branchFile);
  if (!fs.existsSync(branchPath)) continue;
  
  const branch = JSON.parse(fs.readFileSync(branchPath, 'utf8'));
  
  // Function to find and add descriptionRef
  function addDescRef(node) {
    if (node.id === id && !node.descriptionRef) {
      node.descriptionRef = `descriptions/${file}`;
      console.log(`Added descriptionRef to ${id} in ${branchFile}`);
    }
    // Recurse
    const keys = ['categories', 'subcategories', 'nodes', 'subnodes', 'leafnodes', 'children'];
    for (const key of keys) {
      if (node[key] && Array.isArray(node[key])) {
        for (const child of node[key]) {
          addDescRef(child);
        }
      }
    }
  }
  
  addDescRef(branch);
  fs.writeFileSync(branchPath, JSON.stringify(branch, null, 2));
}
