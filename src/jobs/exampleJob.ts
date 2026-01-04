import { Job } from 'bullmq';
import { defaultQueue } from './queue';
import { exampleService } from '../services/exampleService';

export interface ExampleJobData {
  message: string;
  data?: any;
}

// Add job to queue
export const addExampleJob = async (data: ExampleJobData) => {
  if (!defaultQueue) {
    throw new Error('Default queue not available. Redis connection required.');
  }
  return await defaultQueue.add('example-job', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
};

// Process job
export const processExampleJob = async (job: Job<ExampleJobData>) => {
  console.log(`Processing job ${job.id} with data:`, job.data);
  
  try {
    // Process the job using services
    const result = await exampleService.processData(job.data);
    
    console.log(`Job ${job.id} completed successfully:`, result);
    return result;
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
};

