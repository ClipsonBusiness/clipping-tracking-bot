import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create queue
export const createQueue = (queueName: string = 'default') => {
  return new Queue(queueName, {
    connection,
  });
};

// Create queue events
export const createQueueEvents = (queueName: string = 'default') => {
  return new QueueEvents(queueName, {
    connection,
  });
};

// Create worker
export const createWorker = (queueName: string = 'default', processor: any) => {
  return new Worker(queueName, processor, {
    connection,
  });
};

// Default queue instance
export const defaultQueue = createQueue('default');

