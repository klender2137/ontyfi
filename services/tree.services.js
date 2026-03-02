import fs from 'fs';
import path from 'path';
import treeModular from './treeModular.service.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const CRYPTO_TREE_PATH = path.join(DATA_DIR, 'cryptoTree.json');

/**
 * Legacy-compatible tree service
 * Internally uses modular loader but maintains original API
 */

// Load tree data - returns full merged tree with resolved descriptions
function loadTreeData() {
  try {
    // Use modular loader to get full tree
    return treeModular.getFullTree();
  } catch (error) {
    console.error('Error loading tree data:', error);
    return { fields: [] };
  }
}

// Save tree data
function saveTreeData(treeData) {
  try {
    // Use modular service to save
    return treeModular.saveTreeData(treeData);
  } catch (error) {
    console.error('Error saving tree data:', error);
    return false;
  }
}

// Get full tree
function getFullTree() {
  return treeModular.getFullTree();
}

// Get field by ID
function getFieldById(fieldId) {
  return treeModular.getFieldById(fieldId);
}

// Get category by field ID and category ID
function getCategory(fieldId, categoryId) {
  return treeModular.getCategory(fieldId, categoryId);
}

// Find node in tree recursively
function findNodeInTree(nodes, targetId) {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    
    const childArrays = [
      node.categories || [],
      node.subcategories || [],
      node.nodes || [],
      node.subnodes || [],
      node.leafnodes || [],
      node.children || []
    ];
    
    for (const childArray of childArrays) {
      const found = findNodeInTree(childArray, targetId);
      if (found) return found;
    }
  }
  return null;
}

// Save article to tree
function saveArticleToTree(articleData) {
  return treeModular.saveArticleToTree(articleData);
}

// Reload tree data (force refresh)
function reloadTreeData() {
  return treeModular.reloadTreeData();
}

// Clear cache
function clearCache() {
  treeModular.clearCache();
}

export default {
  getFullTree,
  getFieldById,
  getCategory,
  findNodeInTree,
  saveArticleToTree,
  loadTreeData,
  saveTreeData,
  reloadTreeData,
  clearCache
};
