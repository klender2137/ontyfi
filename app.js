import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// API routes
import treeRoutes from './routes/tree.routes.js';
import authSimpleRoutes from './routes/auth-simple.routes.js';
import solanaAuthRoutes from './routes/solana-auth.routes.js';
import ethereumAuthRoutes from './routes/ethereum-auth.routes.js';
import activityAnalyticsRoutes from './routes/activity-analytics.routes.js';
import embedRoutes from './routes/embed.routes.js';
import insightsRoutes from './routes/insights.routes.js';
import financeRoutes from './routes/finance.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
app.use('/api/tree', treeRoutes);
app.use('/api/auth-simple', authSimpleRoutes);
app.use('/api/solana-auth', solanaAuthRoutes);
app.use('/api/ethereum-auth', ethereumAuthRoutes);
app.use('/api/analytics', activityAnalyticsRoutes);
app.use('/api/embed', embedRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/notifications', notificationsRoutes);

// Start notification scheduler (FCM jobs)
import './services/notification-scheduler.js';

// Serve static frontend
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Serve data folder for JSON files
app.use('/data', express.static(path.join(__dirname, 'data')));

// Fallback to index.html for SPA-style routing (frontend handles actual routes)
// Exclude /api/* routes and asset files from being caught by the wildcard
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)$/)) {
    return next();
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

export default app;
