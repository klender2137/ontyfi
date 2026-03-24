import express from 'express';
import { getDefaultDriveFolderId, getDriveFiles, getDriveFileContent } from '../services/drive.service.js';

const router = express.Router();

router.get('/file-content', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ ok: false, error: 'File ID is required' });
    
    const content = await getDriveFileContent(id);
    
    // If it's a string (text file), send it as text
    if (typeof content === 'string') {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(content);
    }
    
    // Otherwise it might be a Buffer or stream (for binary files)
    return res.send(content);
  } catch (error) {
    console.error('[Insights API] Error fetching file content:', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch file content' });
  }
});

router.get('/finance-resources', async (req, res) => {
  try {
    const folderId = typeof req.query.folderId === 'string' && req.query.folderId.trim()
      ? req.query.folderId.trim()
      : getDefaultDriveFolderId();

    const files = await getDriveFiles(folderId);
    return res.json({ ok: true, folderId, fetchedAtMs: Date.now(), count: files.length, files });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Failed to load finance resources' });
  }
});

export default router;
