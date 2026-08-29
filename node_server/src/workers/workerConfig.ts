import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';

// Standard worker configuration
export const workerConfig = {
  connection: redisConnection,
  lockDuration: 60 * 60 * 1000, // 60 minutes lock duration (increased)
  stalledInterval: 60 * 1000,    // Check for stalled jobs every 60 seconds
  maxStalledCount: 3,            // Max number of times a job can be stalled
  concurrency: 1,                // Process one job at a time per worker
};

export const createWorker = (queueName: string, processor: any) => {
  const worker = new Worker(queueName, processor, workerConfig);
  
  worker.on('ready', () => {
    console.log(`Worker ${queueName} is ready and waiting for jobs...`);
  });

  worker.on('active', (job) => {
    console.log(`Worker ${queueName} is processing job ${job.id}`);
  });

  worker.on('completed', (job) => {
    console.log(`Worker ${queueName} completed job ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Worker ${queueName} failed job ${job?.id}:`, err);
  });

  worker.on('error', (err) => {
    console.error(`Worker ${queueName} error:`, err);
  });

  return worker;
};
