import { Worker, Job as BullJob } from 'bullmq';
import { Job, JobStatus } from '../types/job';
import { logger } from '../utils/logger';
import { jobService } from '../services/job.service';
import { defaultQueueOptions, QUEUE_NAMES } from '../config/bullmq.config';
import { cacheService } from '../services/cache.service';

class JobWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      QUEUE_NAMES.JOB_QUEUE,
      this.processJob.bind(this),
      defaultQueueOptions
    );

    this.worker.on('completed', this.onJobCompleted.bind(this));
    this.worker.on('failed', (job: BullJob | undefined, error: Error) => this.onJobFailed(job, error));
  }

  async start(): Promise<void> {
    logger.info('BullMQ worker started');
  }

  private async processJob(bullJob: BullJob): Promise<void> {
    const job: Job = bullJob.data;
    logger.info('Processing job', { jobId: job.id, jobName: job.name, enabled: job.enabled });

    // Double-check if job is still enabled before processing
    const currentJob = await jobService.getJobById(job.id);
    if (!currentJob) {
      logger.warn('Job not found during processing, skipping', { jobId: job.id, jobName: job.name });
      return;
    }

    if (!currentJob.enabled) {
      logger.warn('Job is disabled, skipping execution', { 
        jobId: job.id, 
        jobName: job.name,
        enabled: currentJob.enabled 
      });
      return;
    }

    await jobService.updateJob(job.id, { 
      status: JobStatus.RUNNING,
      lastRunAt: new Date() 
    });

    await cacheService.invalidateJobListCaches();

    await this.executeJob(currentJob);

    await jobService.updateJob(job.id, { 
      status: JobStatus.COMPLETED,
      lastRunAt: new Date()
    });

    await cacheService.invalidateJobListCaches();
  }

  private async onJobCompleted(bullJob: BullJob): Promise<void> {
    const job: Job = bullJob.data;
    logger.info('Job completed', { jobId: job.id, jobName: job.name });

    await cacheService.invalidateJobListCaches();
  }

  private async onJobFailed(bullJob: BullJob | undefined, error: Error): Promise<void> {
    if (!bullJob) {
      logger.error('Job failed but no job data available', { error: error.message });
      return;
    }

    const job: Job = bullJob.data;
    logger.error('Job failed', { 
      jobId: job.id, 
      jobName: job.name, 
      error: error.message 
    });

    await jobService.updateJob(job.id, { 
      status: JobStatus.FAILED 
    });

    await cacheService.invalidateJobListCaches();
  }

  private async executeJob(job: Job): Promise<void> {
    logger.info('Executing job', { jobId: job.id, jobName: job.name });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info('Job execution completed', { jobId: job.id, jobName: job.name });
  }

  async close(): Promise<void> {
    await this.worker.close();
    logger.info('BullMQ worker closed');
  }
}

export const jobWorker = new JobWorker(); 