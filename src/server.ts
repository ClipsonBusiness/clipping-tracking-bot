import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createQueue } from './jobs/queue';
import { getPrismaClient } from './utils/prisma';

// Load environment variables
dotenv.config();

const app = express();

// Initialize Prisma with lazy loading and error handling
let prisma: any = null;

// Railway provides PORT via environment variable, default to 3001 for local
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Initialize BullMQ queue (optional - won't crash if Redis unavailable)
let queue: any = null;
let metricsWorker: any = null;
let metricsQueue: any = null;
let metricsSchedulerInterval: NodeJS.Timeout | null = null;

try {
  if (process.env.REDIS_URL) {
    queue = createQueue();
    // Initialize workers only if Redis is available
    import('./jobs/worker').catch(err => {
      console.warn('⚠️ Failed to load worker (Redis may be unavailable):', err.message);
    });
    import('./jobs/metricsWorker').then(module => {
      metricsWorker = module.metricsWorker;
    }).catch(err => {
      console.warn('⚠️ Failed to load metrics worker:', err.message);
    });
    import('./jobs/metricsQueue').then(module => {
      metricsQueue = module.metricsQueue;
    }).catch(err => {
      console.warn('⚠️ Failed to load metrics queue:', err.message);
    });
  } else {
    console.warn('⚠️ REDIS_URL not set - workers and queues disabled');
  }
} catch (error: any) {
  console.warn('⚠️ Failed to initialize queues/workers:', error.message);
  console.warn('⚠️ App will continue without background job processing');
}

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
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`REDIS_URL: ${process.env.REDIS_URL ? '✅ Set' : '❌ Missing'}`);
  
  // Initialize Prisma (non-blocking)
  try {
    if (process.env.DATABASE_URL) {
      prisma = getPrismaClient();
      await prisma.$connect();
      console.log('✅ Database connected successfully');
    } else {
      console.warn('⚠️ DATABASE_URL not set - database operations will fail');
    }
  } catch (dbError: any) {
    console.error('❌ Database connection failed:', dbError.message);
    console.error('⚠️ App will continue but database operations may fail');
    // Don't exit - let the app start and handle errors gracefully
  }
  
  // Start metrics scheduler (only if Redis is available)
  if (process.env.REDIS_URL) {
    try {
      import('./jobs/metricsScheduler').then(module => {
        metricsSchedulerInterval = module.startMetricsScheduler();
        console.log('✅ Metrics scheduler started');
      }).catch(err => {
        console.warn('⚠️ Failed to start metrics scheduler:', err.message);
      });
    } catch (error: any) {
      console.warn('⚠️ Failed to start metrics scheduler:', error.message);
    }
  } else {
    console.warn('⚠️ Metrics scheduler disabled (REDIS_URL not set)');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (metricsSchedulerInterval) {
    clearInterval(metricsSchedulerInterval);
  }
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.warn('Error disconnecting Prisma:', err);
    }
  }
  if (queue) await queue.close().catch(() => {});
  if (metricsQueue) await metricsQueue.close().catch(() => {});
  if (metricsWorker) await metricsWorker.close().catch(() => {});
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (metricsSchedulerInterval) {
    clearInterval(metricsSchedulerInterval);
  }
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.warn('Error disconnecting Prisma:', err);
    }
  }
  if (queue) await queue.close().catch(() => {});
  if (metricsQueue) await metricsQueue.close().catch(() => {});
  if (metricsWorker) await metricsWorker.close().catch(() => {});
  process.exit(0);
});

export default app;

// Build timestamp: Sun Jan  4 00:35:14 GMT 2026
