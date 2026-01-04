import { createWorker } from './queue';
import { processExampleJob } from './exampleJob';

// Create and start workers (only if Redis is available)
let exampleWorker: any = null;

try {
  exampleWorker = createWorker('default', async (job: any) => {
    switch (job.name) {
      case 'example-job':
        return await processExampleJob(job);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  });

  // Worker event handlers
  exampleWorker.on('completed', (job: any) => {
    console.log(`Job ${job?.id} has been completed`);
  });

  exampleWorker.on('failed', (job: any, err: any) => {
    console.error(`Job ${job?.id} has failed with error:`, err);
  });

  exampleWorker.on('error', (err: any) => {
    console.error('Worker error:', err);
  });

  console.log('Workers started');
} catch (error: any) {
  console.warn('⚠️ Failed to create worker (Redis may be unavailable):', error.message);
}

export { exampleWorker };

