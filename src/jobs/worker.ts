import { createWorker } from './queue';
import { processExampleJob } from './exampleJob';

// Create and start workers
const exampleWorker = createWorker('default', async (job: any) => {
  switch (job.name) {
    case 'example-job':
      return await processExampleJob(job);
    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
});

// Worker event handlers
exampleWorker.on('completed', (job) => {
  console.log(`Job ${job?.id} has been completed`);
});

exampleWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} has failed with error:`, err);
});

exampleWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Workers started');

export { exampleWorker };

