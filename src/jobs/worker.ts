import { createWorker } from './queue';
import { processExampleJob } from './exampleJob';
import type { Worker, Job } from 'bullmq';

// Create and start workers (only if Redis is available)
let exampleWorker: Worker | null = null;

try {
  exampleWorker = createWorker('default', async (job: Job) => {
    switch (job.name) {
      case 'example-job':
        return await processExampleJob(job as any);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  });

  // Worker event handlers with explicit types
  exampleWorker.on('completed', (job: Job) => {
    console.log(`Job ${job?.id} has been completed`);
  });

  exampleWorker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`Job ${job?.id} has failed with error:`, err);
  });

  exampleWorker.on('error', (err: Error) => {
    console.error('Worker error:', err);
  });

  console.log('Workers started');
} catch (error: any) {
  console.warn('⚠️ Failed to create worker (Redis may be unavailable):', error.message);
}

export { exampleWorker };

