import express from 'express';
import treeService from '../services/tree.services.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get entire tree
router.get('/', (req, res) => {
  try {
    const tree = treeService.getFullTree();
    // Ensure descriptions are resolved for frontend compatibility
    if (!tree.fields || tree.fields.length === 0) {
      console.warn('No tree fields found, checking trunk data...');
    }
    res.json(tree);
  } catch (error) {
    console.error('Error in GET /api/tree:', error);
    res.status(500).json({ error: 'Failed to load tree data', details: error.message });
  }
});

// Get single description file (for client-side fallback)
router.get('/description/:descriptionRef', (req, res) => {
  try {
    const descriptionRef = decodeURIComponent(req.params.descriptionRef);
    const descPath = path.join(__dirname, '../data', descriptionRef);
    
    if (!fs.existsSync(descPath)) {
      return res.status(404).send('Description file not found');
    }
    
    const content = fs.readFileSync(descPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (error) {
    console.error('Error loading description:', error);
    res.status(500).send('Failed to load description');
  }
});

// Get single field by id
router.get('/field/:id', (req, res) => {
  const field = treeService.getFieldById(req.params.id);
  field ? res.json(field) : res.status(404).send('Not found');
});

// Get category within a field
router.get('/field/:fieldId/category/:categoryId', (req, res) => {
  const category = treeService.getCategory(req.params.fieldId, req.params.categoryId);
  category ? res.json(category) : res.status(404).send('Not found');
});

// Save new article to tree (admin only)
router.post('/article', (req, res) => {
  try {
    const result = treeService.saveArticleToTree(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error saving article:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

