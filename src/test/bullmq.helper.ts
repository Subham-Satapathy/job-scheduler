import { Queue, Worker } from 'bullmq';
import { defaultQueueOptions, QUEUE_NAMES } from '../config/bullmq.config';

export class BullMQTestHelper {
  private queue: Queue;
  private worker: Worker | null = null;

  constructor() {
    this.queue = new Queue(QUEUE_NAMES.JOB_QUEUE, defaultQueueOptions);
  }

  async setup() {
    // Obliterate any existing jobs
    await this.queue.obliterate({ force: true });
  }

  async teardown() {
    await this.queue.close();
    if (this.worker) {
      await this.worker.close();
    }
  }

  getQueue(): Queue {
    return this.queue;
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0
    };
  }

  async waitForJobCompletion(jobId: string, timeout = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }
      const state = await job.getState();
      if (state === 'completed' || state === 'failed') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Job ${jobId} did not complete within ${timeout}ms`);
  }
} 