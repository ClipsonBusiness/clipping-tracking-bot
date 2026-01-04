import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection (shared with queue.ts)
import { connection } from './queue';

// Metrics queue instance (only if Redis is available)
let _metricsQueue: Queue | null = null;

function getMetricsQueue(): Queue | null {
  if (!_metricsQueue && connection) {
    try {
      _metricsQueue = new Queue('metrics', {
        connection,
      });
    } catch (error: any) {
      console.warn('⚠️ Failed to create metrics queue:', error.message);
    }
  }
  return _metricsQueue;
}

export const metricsQueue = getMetricsQueue();

export interface MetricsJobData {
  submissionId: string;
}

/**
 * Add a metrics fetch job to the queue
 * Uses submissionId as jobId to prevent duplicates
 */
export const addMetricsJob = async (submissionId: string) => {
  const queue = getMetricsQueue();
  if (!queue) {
    throw new Error('Metrics queue not available. Redis connection required.');
  }
  return await queue.add(
    'FETCH_YOUTUBE_METRICS',
    { submissionId },
    {
      jobId: submissionId, // Dedupe by submissionId
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }
  );
};

