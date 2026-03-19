import express from 'express';
import { getDefaultDriveFolderId, getDriveFiles } from '../services/drive.service.js';

const router = express.Router();

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
