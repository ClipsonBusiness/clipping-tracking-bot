import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import apiRoutes from '../src/routes';
import adminRoutes from '../src/routes/admin';
import { adminMiddleware } from '../src/middleware/admin';

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);
app.use('/admin', adminMiddleware, adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export as Vercel serverless function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
