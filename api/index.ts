import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables (Vercel provides them, but dotenv helps with local dev)
dotenv.config();

import apiRoutes from '../src/routes';
import adminRoutes from '../src/routes/admin';
import { adminMiddleware } from '../src/middleware/admin';

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes - Vercel rewrites handle the /api prefix, so routes should be relative
app.use('/api', apiRoutes);
app.use('/admin', adminMiddleware, adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root path
app.get('/', (req, res) => {
  res.json({ 
    message: 'Clipping Tracking Bot API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      admin: '/admin'
    }
  });
});

// Export as Vercel serverless function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
