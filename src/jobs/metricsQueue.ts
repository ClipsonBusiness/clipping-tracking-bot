import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Metrics queue instance
export const metricsQueue = new Queue('metrics', {
  connection,
});

export interface MetricsJobData {
  submissionId: string;
}

/**
 * Add a metrics fetch job to the queue
 * Uses submissionId as jobId to prevent duplicates
 */
export const addMetricsJob = async (submissionId: string) => {
  return await metricsQueue.add(
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

