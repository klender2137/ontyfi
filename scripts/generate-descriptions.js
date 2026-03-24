import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const BRANCHES_DIR = path.join(DATA_DIR, 'branches');
const DESCRIPTIONS_DIR = path.join(DATA_DIR, 'descriptions');

// Ensure descriptions directory exists
if (!fs.existsSync(DESCRIPTIONS_DIR)) {
  fs.mkdirSync(DESCRIPTIONS_DIR, { recursive: true });
}

function generateMarkdown(node, branchName) {
  const name = node.name || node.id;
  const id = node.id;
  const description = node.description || `Comprehensive guide and strategic overview for ${name}.`;
  const tags = node.tags || [];
  
  let content = `# ${name}\n\n`;
  content += `**ID:** ${id}\n`;
  content += `**Branch:** ${branchName}\n\n`;
  content += `## Description\n\n${description}\n\n`;
  
  if (tags.length > 0) {
    content += `## Tags\n\n`;
    tags.forEach(tag => {
      content += `- ${tag}\n`;
    });
  }
  
  return content;
}

function processNode(node, branchName, branchFileName) {
  if (!node || !node.id) return;

  // Generate description file name
  const safeId = node.id.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
  const fileName = `${branchFileName.replace('.json', '')}_${safeId}.md`;
  const filePath = path.join(DESCRIPTIONS_DIR, fileName);

  // Update node with descriptionRef if it doesn't have one
  if (!node.descriptionRef) {
    node.descriptionRef = `descriptions/${fileName}`;
  }

  // Create the markdown file
  const mdContent = generateMarkdown(node, branchName);
  fs.writeFileSync(filePath, mdContent);
  console.log(`Generated: ${fileName}`);

  // Process children
  const childKeys = ['categories', 'subcategories', 'nodes', 'subnodes', 'leafnodes', 'children', 'institutions', 'tiles', 'functions', 'roles', 'activities'];
  childKeys.forEach(key => {
    if (node[key] && Array.isArray(node[key])) {
      node[key].forEach(child => processNode(child, branchName, branchFileName));
    }
  });
}

function main() {
  const files = fs.readdirSync(BRANCHES_DIR).filter(f => f.endsWith('.json'));
  
  files.forEach(file => {
    const filePath = path.join(BRANCHES_DIR, file);
    try {
      const branchData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const branchName = branchData.name || branchData.id || file;
      
      console.log(`Processing branch: ${branchName} (${file})`);
      processNode(branchData, branchName, file);
      
      // Save the updated branch JSON with descriptionRefs
      fs.writeFileSync(filePath, JSON.stringify(branchData, null, 2));
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
    }
  });
}

main();
