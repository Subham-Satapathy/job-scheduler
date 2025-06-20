import { QueueOptions, WorkerOptions } from 'bullmq';
import { envConfig } from './env.config';

export const defaultQueueOptions: QueueOptions = {
  connection: {
    host: envConfig.REDIS_HOST,
    port: envConfig.REDIS_PORT,
    password: envConfig.REDIS_PASSWORD,
  },
  prefix: envConfig.BULLMQ_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24 hours
      count: 1000, // keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days
      count: 5000, // keep last 5000 failed jobs
    },
  },
};

export const defaultWorkerOptions: WorkerOptions = {
  connection: defaultQueueOptions.connection,
  prefix: defaultQueueOptions.prefix,
  concurrency: 10,
  limiter: {
    max: 1000,
    duration: 1000,
  },
};

export const QUEUE_NAMES = {
  JOB_QUEUE: 'job-queue',
} as const;

// Helper function to create queue name with prefix
export const getQueueName = (name: string): string => {
  // Use underscore instead of colon for prefix separation
  return `${envConfig.BULLMQ_PREFIX}_${name}`;
}; 