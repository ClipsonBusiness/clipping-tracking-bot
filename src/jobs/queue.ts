import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection (with error handling)
let connection: IORedis | null = null;

try {
  if (process.env.REDIS_URL) {
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });
    
    connection.on('error', (err) => {
      console.warn('⚠️ Redis connection error:', err.message);
    });
    
    connection.on('connect', () => {
      console.log('✅ Redis connected');
    });
  } else {
    console.warn('⚠️ REDIS_URL not set - queues and workers disabled');
  }
} catch (error: any) {
  console.warn('⚠️ Failed to initialize Redis:', error.message);
}

// Export connection for use in other modules
export { connection };

// Create queue
export const createQueue = (queueName: string = 'default') => {
  if (!connection) {
    throw new Error('Redis connection not available. Set REDIS_URL environment variable.');
  }
  return new Queue(queueName, {
    connection,
  });
};

// Create queue events
export const createQueueEvents = (queueName: string = 'default') => {
  if (!connection) {
    throw new Error('Redis connection not available. Set REDIS_URL environment variable.');
  }
  return new QueueEvents(queueName, {
    connection,
  });
};

// Create worker
export const createWorker = (queueName: string = 'default', processor: any) => {
  if (!connection) {
    throw new Error('Redis connection not available. Set REDIS_URL environment variable.');
  }
  return new Worker(queueName, processor, {
    connection,
  });
};

// Default queue instance (only if Redis is available)
let _defaultQueue: Queue | null = null;
export const defaultQueue = (() => {
  if (!_defaultQueue && connection) {
    try {
      _defaultQueue = createQueue('default');
    } catch (error: any) {
      console.warn('⚠️ Failed to create default queue:', error.message);
    }
  }
  return _defaultQueue;
})();

