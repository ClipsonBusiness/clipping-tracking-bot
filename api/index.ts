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

// Serve static files from public directory
app.use(express.static('public'));

// Serve frontend pages at clean URLs
app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: 'public' });
});

app.get('/clipper', (req, res) => {
  res.sendFile('clipper.html', { root: 'public' });
});

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
  try {
    // Ensure DATABASE_URL is available (Vercel should provide it)
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'DATABASE_URL environment variable is not configured'
      });
    }
    
    return app(req, res);
  } catch (error: any) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error occurred'
    });
  }
}
