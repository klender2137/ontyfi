import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix 5: Ensure DATA_DIR uses absolute path and verify it exists
const DATA_DIR = (() => {
  const dir = path.join(__dirname, '../data');
  if (!fs.existsSync(dir)) {
    console.error(`[treeModular] DATA_DIR does not exist: ${dir}`);
    // Try alternative paths
    const altDir = path.resolve(process.cwd(), 'data');
    if (fs.existsSync(altDir)) {
      console.log(`[treeModular] Using alternative DATA_DIR: ${altDir}`);
      return altDir;
    }
  }
  return dir;
})();
const TRUNK_PATH = path.join(DATA_DIR, 'cryptoTree.json');
const BRANCHES_DIR = path.join(DATA_DIR, 'branches');
const DESCRIPTIONS_DIR = path.join(DATA_DIR, 'descriptions');

// Cache for loaded data
let trunkCache = null;
let branchesCache = null;
let mergedCache = null;

/**
 * Load the trunk file (cryptoTree.json)
 */
function loadTrunk() {
  if (trunkCache) return trunkCache;
  
  try {
    const rawData = fs.readFileSync(TRUNK_PATH, 'utf8');
    const parsed = JSON.parse(rawData);
    // Fix 2: Validate trunk structure has proper fields array
    if (!parsed.fields || !Array.isArray(parsed.fields)) {
      console.error('[loadTrunk] Trunk missing fields array, returning fallback');
      trunkCache = { version: '2.0-modular', type: 'cryptoTree-trunk', fields: [] };
      return trunkCache;
    }
    trunkCache = parsed;
    return trunkCache;
  } catch (error) {
    // Fix 3: Clear cache on error to prevent stale data
    trunkCache = null;
    console.error('Error loading trunk:', error);
    return { version: '2.0-modular', type: 'cryptoTree-trunk', fields: [] };
  }
}

/**
 * Load a branch file
 */
function loadBranch(branchFile) {
  if (!branchFile || typeof branchFile !== 'string') {
    console.warn('[loadBranch] Invalid branch file reference:', branchFile);
    return null;
  }
  const branchPath = path.join(DATA_DIR, branchFile);
  try {
    const rawData = fs.readFileSync(branchPath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Error loading branch ${branchFile}:`, error);
    return null;
  }
}

/**
 * Strips markdown syntax from text to create plain text previews
 * @param {string} text - The markdown text to clean
 * @returns {string} - Plain text without markdown syntax
 */
function stripMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // Remove headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove blockquotes
    .replace(/^\s*>\s*/gm, '')
    // Remove list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Remove links but keep text [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bare URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Remove images ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // Remove horizontal rules
    .replace(/^\s*---+\s*$/gm, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Normalize whitespace
    .replace(/\n\s*\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Load description from markdown file
 */
function loadDescription(descRef) {
  if (!descRef) return null;
  
  // Fix Problem 4: Ensure proper path resolution from data directory
  let descPath = path.join(DATA_DIR, descRef);

  // If the file doesn't exist, attempt to locate a similarly named alternative
  // (e.g. trunk may reference "speculation-alpha.md" while generator
  // creates "speculation-alpha_speculation-alpha.md").
  if (!fs.existsSync(descPath)) {
    try {
      const dir = path.dirname(descPath);
      const base = path.basename(descPath, '.md');
      const candidates = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f.includes(base));
      if (candidates.length > 0) {
        console.warn(`Original description file not found: ${descPath}, using ${candidates[0]}`);
        descPath = path.join(dir, candidates[0]);
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    const content = fs.readFileSync(descPath, 'utf8');
    
    // Extract description from markdown by removing metadata lines and the
    // tags section. This returns virtually the entire rendered markdown content
    // except for the `#` title, ID/Path/Branch metadata and the tag list itself.
    function stripMetadataAndTags(text) {
      const lines = text.split('\n');
      const resultLines = [];
      let skippingTags = false;
      let skippingDescription = false;

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (/^#\s+/.test(line)) continue;
        if (/^\*\*ID:/i.test(line)) continue;
        if (/^\*\*Path:/i.test(line)) continue;
        if (/^\*\*Branch:/i.test(line)) continue;
        
        // detect and skip Description header
        if (/^##\s+Description\b/i.test(trimmedLine)) {
          skippingDescription = true;
          continue;
        }
        
        if (/^##\s+Tags\b/i.test(trimmedLine)) {
          skippingTags = true;
          skippingDescription = false; // Stop skipping description when we hit tags
          continue;
        }
        if (skippingTags && /^##\s+/.test(trimmedLine)) {
          skippingTags = false; // end of tags block
        }
        if (skippingTags) continue;
        
        // skip the Description header line itself
        if (skippingDescription) {
          skippingDescription = false; // Only skip the header line, then start collecting
          continue;
        }
        
        resultLines.push(line);
      }
      return resultLines.join('\n').trim();
    }

    let description = stripMetadataAndTags(content);
    
    // Extract only first 2-3 sentences for short description preview
    function extractFirstSentences(text, maxSentences = 3) {
      // Split by sentence endings (., !, ?) followed by space or end of line
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      const result = sentences.slice(0, maxSentences).join(' ').trim();
      return result || text.substring(0, 200); // fallback to first 200 chars
    }
    
    // Limit to first 2-3 sentences for tile preview
    description = extractFirstSentences(description, 3);
    
    // Strip markdown formatting for clean tile preview
    description = stripMarkdown(description);
    
    // fallback to earlier heuristics if extraction produced nothing
    if (!description) {
      const lines = content.split('\n');
      let foundDescription = false;
      const descriptionLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#') || line.startsWith('**') || line.startsWith('ID:') || line.startsWith('Path:') || line === '') {
          continue;
        }
        if (/^##\s+Tags/i.test(line)) {
          break;
        }
        if (line && !foundDescription) {
          foundDescription = true;
        }
        if (foundDescription && line) {
          descriptionLines.push(line);
        }
        if (descriptionLines.length >= 10) {
          break;
        }
      }
      const fallbackDesc = descriptionLines.join(' ').trim();
      if (fallbackDesc) {
        console.log(`Using fallback description for ${descRef}`);
        description = stripMarkdown(fallbackDesc);
      }
    }
    
    // Enhanced fallback: if no description section, get first meaningful paragraph
    if (!description) {
      const lines = content.split('\n');
      let foundDescription = false;
      const descriptionLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip headers, metadata, and empty lines
        if (line.startsWith('#') || line.startsWith('**') || line.startsWith('ID:') || line.startsWith('Path:') || line === '') {
          continue;
        }
        // Stop at next section
        if (line.startsWith('##') && foundDescription) {
          break;
        }
        // Start collecting description content
        if (line && !foundDescription) {
          foundDescription = true;
        }
        if (foundDescription && line) {
          descriptionLines.push(line);
        }
        // Stop if we have enough content
        if (descriptionLines.length >= 5) {
          break;
        }
      }
      
      const fallbackDesc = descriptionLines.join(' ').trim();
      if (fallbackDesc) {
        console.log(`Using fallback description for ${descRef}`);
        description = stripMarkdown(fallbackDesc);
      }
    }
    
    // Extract tags from markdown - improved regex to handle various formats
    let tags = [];
    const tagsMatch = content.match(/## Tags\s*\n([\s\S]*?)(?=\n\n##|\n\n---|$)/);
    
    if (tagsMatch) {
      tags = tagsMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^[-*+•]\s*/, '').replace(/^\d+\.\s*/, '')) // Remove various bullet formats
        .filter(line => line.length > 0);
    }
    
    console.log(`Loaded description for ${descRef}: ${description ? description.substring(0, 50) + '...' : 'null'}, tags: [${tags.join(', ')}]`);
    
    return { description, tags };
  } catch (error) {
    // Enhanced error handling with detailed logging
    console.error(`Error loading description ${descRef}:`, error.message);
    console.log(`Attempted path: ${descPath}`);
    console.log(`File exists: ${fs.existsSync(descPath)}`);
    
    // Return fallback description instead of null
    const nodeName = descRef.replace(/^.*\//, '').replace('.md', '');
    const fallbackDesc = `Description for ${nodeName} - Content loading...`;
    return { description: fallbackDesc, tags: [] };
  }
}

/**
 * Recursively resolve description references in a node
 */
function resolveDescriptions(node) {
  if (!node) return;
  
  // If node has a descriptionRef, load actual description and tags
  if (node.descriptionRef) {
    const result = loadDescription(node.descriptionRef);
    if (result.description) {
      node.description = result.description;
      console.log(`Resolved description for ${node.id}: ${result.description.substring(0, 50)}...`);
    } else {
      console.warn(`Failed to resolve description for ${node.id} from ${node.descriptionRef}`);
      // Fix Problem 8: Provide a fallback description
      node.description = `Description for ${node.name || node.id} - Content loading...`;
    }
    
    // Enhanced metadata merging with conflict resolution
    if (result.tags && result.tags.length > 0) {
      if (!node.tags) {
        node.tags = [];
      }
      // Add new tags that don't already exist (case-insensitive)
      result.tags.forEach(tag => {
        const existingTag = node.tags.find(existing => existing.toLowerCase() === tag.toLowerCase());
        if (!existingTag) {
          node.tags.push(tag);
        }
      });
      console.log(`Added ${result.tags.length} tags to ${node.id}: [${result.tags.join(', ')}]`);
    }
    
    // Extract and merge other metadata from description file
    try {
      let descPath = path.join(DATA_DIR, node.descriptionRef);

      if (!fs.existsSync(descPath)) {
        try {
          const dir = path.dirname(descPath);
          const base = path.basename(descPath, '.md');
          const candidates = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f.includes(base));
          if (candidates.length > 0) {
            descPath = path.join(dir, candidates[0]);
          }
        } catch (e) {
          // ignore
        }
      }

      if (fs.existsSync(descPath)) {
        const content = fs.readFileSync(descPath, 'utf8');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch && !node.name) {
          node.name = titleMatch[1].trim();
        }

        const idMatch = content.match(/\*\*ID:\*\*\s+(.+)$/m);
        if (idMatch && !node.id) {
          node.id = idMatch[1].trim();
        }
      } else {
        console.warn(`[resolveDescriptions] Description file not found for ${node.id}: ${node.descriptionRef}`);
      }
    } catch (e) {
      console.warn(`[resolveDescriptions] Failed to read metadata for ${node.id} (${node.descriptionRef}):`, e?.message || e);
    }
    
    // Keep the ref for client-side full description loading
    // This preserves the descriptionRef so the client can load full content
  }
  
  // Process all child arrays
  const childArrays = ['categories', 'subcategories', 'nodes', 'subnodes', 'leafnodes', 'children'];
  for (const key of childArrays) {
    if (node[key] && Array.isArray(node[key])) {
      for (const child of node[key]) {
        resolveDescriptions(child);
      }
    }
  }
}

/**
 * Load all branches and merge them into a full tree structure
 */
function loadAllBranches() {
  if (branchesCache) return branchesCache;
  
  const trunk = loadTrunk();
  const branches = [];
  
  if (trunk.fields && Array.isArray(trunk.fields)) {
    for (const fieldRef of trunk.fields) {
      // Fix 1 & 4: Skip null/undefined entries or entries without file property
      if (!fieldRef || !fieldRef.file) {
        console.warn('[loadAllBranches] Skipping invalid fieldRef:', fieldRef);
        continue;
      }
      // Fix 2: Handle both reference format {file: "xxx"} and direct field objects
      let branchData;
      if (typeof fieldRef.file === 'string') {
        branchData = loadBranch(fieldRef.file);
      } else if (fieldRef.id && fieldRef.name) {
        // Direct field object format (legacy/modular hybrid)
        console.log('[loadAllBranches] Using direct field object:', fieldRef.id);
        branchData = fieldRef;
      }
      if (branchData) {
        // Don't resolve descriptions here - do it in getFullTree()
        branches.push(branchData);
      }
    }
  }
  
  branchesCache = branches;
  return branches;
}

/**
 * Get the full merged tree (trunk + all branches with resolved descriptions)
 */
function getFullTree() {
  if (mergedCache) return mergedCache;
  
  const trunk = loadTrunk();
  const branches = loadAllBranches();
  
  // Ensure all descriptions are resolved before caching
  console.log('Resolving descriptions for all branches...');
  branches.forEach(branch => {
    resolveDescriptions(branch);
  });
  
  mergedCache = {
    version: trunk.version,
    type: 'cryptoTree-full',
    branchCount: branches.length,
    fields: branches
  };
  
  console.log(`Tree loaded with ${branches.length} fields and all descriptions resolved`);
  return mergedCache;
}

/**
 * Clear all caches (useful for hot-reload scenarios)
 * Enhanced with proper cache invalidation
 */
function clearCache() {
  console.log('Clearing all tree data caches...');
  trunkCache = null;
  branchesCache = null;
  mergedCache = null;
  // Also clear any description-specific caches if added in future
  console.log('All caches cleared successfully');
}

/**
 * Reload tree data (force refresh)
 */
function reloadTreeData() {
  clearCache();
  return getFullTree();
}

/**
 * Find a node by ID in the full tree
 */
function findNodeById(nodeId) {
  const tree = getFullTree();
  
  function searchInNodes(nodes) {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      
      const childArrays = [
        node.categories || [],
        node.subcategories || [],
        node.nodes || [],
        node.subnodes || [],
        node.leafnodes || [],
        node.children || []
      ];
      
      for (const children of childArrays) {
        const found = searchInNodes(children);
        if (found) return found;
      }
    }
    return null;
  }
  
  return searchInNodes(tree.fields || []);
}

/**
 * Get field by ID
 */
function getFieldById(fieldId) {
  const tree = getFullTree();
  return tree.fields.find(f => f.id === fieldId) || null;
}

/**
 * Get category by field ID and category ID
 */
function getCategory(fieldId, categoryId) {
  const field = getFieldById(fieldId);
  if (!field || !field.categories) return null;
  return field.categories.find(c => c.id === categoryId) || null;
}

/**
 * Flatten the tree into a single array of all nodes with paths
 */
function flattenTree(nodes, path = []) {
  if (!nodes || !Array.isArray(nodes)) return [];
  
  return nodes.reduce((acc, node) => {
    const currentPath = [...path, { id: node.id, name: node.name }];
    const children = [
      ...(node.categories || []),
      ...(node.subcategories || []),
      ...(node.nodes || []),
      ...(node.subnodes || []),
      ...(node.leafnodes || []),
      ...(node.children || [])
    ];
    return [
      ...acc, 
      { ...node, path: currentPath }, 
      ...flattenTree(children, currentPath)
    ];
  }, []);
}

/**
 * Get all nodes as a flat array with full paths
 */
function getAllNodes() {
  const tree = getFullTree();
  return flattenTree(tree.fields);
}

/**
 * Get description index for quick lookups
 */
function getDescriptionIndex() {
  const trunk = loadTrunk();
  return trunk.descriptionIndex || {};
}

/**
 * Save article to tree (adds to appropriate branch)
 */
function saveArticleToTree(articleData) {
  console.log('Saving article to tree:', articleData);
  
  // Reload to get fresh data
  const tree = reloadTreeData();
  
  // Handle custom location creation
  if (articleData.locationType === 'custom' && articleData.customLocation) {
    const newField = {
      id: `custom-${Date.now()}`,
      name: articleData.customLocation,
      description: `Custom section for ${articleData.customLocation}`,
      tags: articleData.tags || [],
      categories: [],
      isCustom: true,
      createdAt: new Date().toISOString()
    };
    
    const articleNode = {
      id: `article-${Date.now()}`,
      name: articleData.title,
      description: articleData.description,
      tags: articleData.tags || [],
      content: articleData.body,
      bodySections: articleData.bodySections || [],
      images: articleData.images || [],
      createdAt: new Date().toISOString(),
      isArticle: true
    };
    
    newField.categories = [{
      id: `category-${Date.now()}`,
      name: 'Articles',
      description: 'Custom articles',
      tags: [],
      subcategories: [{
        id: `subcategory-${Date.now()}`,
        name: 'General',
        description: 'General articles',
        tags: [],
        nodes: [articleNode]
      }]
    }];
    
    // Add to tree fields
    tree.fields.push(newField);
    
    // Save the updated tree (this updates the merged structure and individual branch)
    if (saveTreeData(tree)) {
      clearCache();
      return { success: true, article: articleNode, customField: newField };
    } else {
      return { success: false, error: 'Failed to save tree data' };
    }
  }
  
  // Handle existing section
  if (articleData.targetSectionId) {
    const flatNodes = flattenTree(tree.fields);
    const targetNode = flatNodes.find(n => n.id === articleData.targetSectionId);
    
    if (!targetNode) {
      return { success: false, error: 'Target section not found' };
    }
    
    const articleNode = {
      id: `article-${Date.now()}`,
      name: articleData.title,
      description: articleData.description,
      tags: articleData.tags || [],
      content: articleData.body,
      bodySections: articleData.bodySections || [],
      images: articleData.images || [],
      createdAt: new Date().toISOString(),
      isArticle: true
    };
    
    // Add to appropriate child array
    if (!targetNode.leafnodes) targetNode.leafnodes = [];
    targetNode.leafnodes.push(articleNode);
    
    // Save the updated tree
    if (saveTreeData(tree)) {
      clearCache();
      return { success: true, article: articleNode };
    } else {
      return { success: false, error: 'Failed to save tree data' };
    }
  }
  
  return { success: false, error: 'Invalid article data' };
}

/**
 * Save tree data back to files
 * Note: This updates both the merged structure and individual branch files
 */
function saveTreeData(tree) {
  try {
    // Save merged version for compatibility
    const mergedPath = path.join(DATA_DIR, 'cryptoTree.merged.json');
    fs.writeFileSync(mergedPath, JSON.stringify(tree, null, 2));
    
    // Update individual branch files
    for (const field of tree.fields) {
      const branchFile = `branch_${field.id.replace(/[^a-z0-9-_]/gi, '_').toLowerCase()}.json`;
      const branchPath = path.join(BRANCHES_DIR, branchFile);
      fs.writeFileSync(branchPath, JSON.stringify(field, null, 2));
    }
    
    // Clear cache to force reload
    clearCache();
    
    console.log('Tree data saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving tree data:', error);
    return false;
  }
}

export default {
  loadTrunk,
  loadBranch,
  loadDescription,
  loadAllBranches,
  getFullTree,
  reloadTreeData,
  findNodeById,
  getFieldById,
  getCategory,
  flattenTree,
  getAllNodes,
  getDescriptionIndex,
  saveArticleToTree,
  saveTreeData,
  clearCache
};
