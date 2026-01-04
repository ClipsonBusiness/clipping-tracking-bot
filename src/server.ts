import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createQueue } from './jobs/queue';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();
// Railway provides PORT via environment variable, default to 3001 for local
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Initialize BullMQ queue
const queue = createQueue();

// Initialize workers (import to start processing jobs)
import './jobs/worker';
import { metricsWorker } from './jobs/metricsWorker';
import { startMetricsScheduler } from './jobs/metricsScheduler';
import { metricsQueue } from './jobs/metricsQueue';

// Store scheduler interval for cleanup
let metricsSchedulerInterval: NodeJS.Timeout | null = null;

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
import apiRoutes from './routes';
import adminRoutes from './routes/admin';
import { adminMiddleware } from './middleware/admin';

// Use routes
app.use('/api', apiRoutes);

// Admin routes (protected by admin middleware)
app.use('/admin', adminMiddleware, adminRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`REDIS_URL: ${process.env.REDIS_URL ? '✅ Set' : '❌ Missing'}`);
  
  // Start metrics scheduler
  try {
    metricsSchedulerInterval = startMetricsScheduler();
  } catch (error) {
    console.error('Failed to start metrics scheduler:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (metricsSchedulerInterval) {
    clearInterval(metricsSchedulerInterval);
  }
  await prisma.$disconnect();
  await queue.close();
  await metricsQueue.close();
  await metricsWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (metricsSchedulerInterval) {
    clearInterval(metricsSchedulerInterval);
  }
  await prisma.$disconnect();
  await queue.close();
  await metricsQueue.close();
  await metricsWorker.close();
  process.exit(0);
});

export default app;

// Build timestamp: Sun Jan  4 00:35:14 GMT 2026
