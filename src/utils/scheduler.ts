import { logger } from './logger';
import { jobService } from '../services/job.service';
import { Job, JobFrequency } from '../types/job';

export function calculateNextRun(job: Job): Date {
  const now = new Date();
  const startDate = new Date(job.startDate);

  // If job has an end date and it's passed, return start date
  if (job.endDate && new Date(job.endDate) < now) {
    return startDate;
  }

  // If job hasn't started yet, return start date
  if (startDate > now) {
    return startDate;
  }

  // Normalize frequency to uppercase for backward compatibility
  const normalizedFrequency = job.frequency.toString().toUpperCase() as JobFrequency;

  // For one-time jobs, return start date
  if (normalizedFrequency === JobFrequency.ONCE) {
    return startDate;
  }

  // For recurring jobs, calculate next run based on frequency
  const lastRun = job.lastRunAt ? new Date(job.lastRunAt) : startDate;
  const nextRun = new Date(lastRun);

  switch (normalizedFrequency) {
    case JobFrequency.DAILY:
      nextRun.setDate(nextRun.getDate() + 1);
      break;
    case JobFrequency.WEEKLY:
      nextRun.setDate(nextRun.getDate() + 7);
      break;
    case JobFrequency.MONTHLY:
      nextRun.setMonth(nextRun.getMonth() + 1);
      break;
    case JobFrequency.CUSTOM:
      if (!job.cronExpression) {
        throw new Error('Cron expression is required for custom frequency jobs');
      }
      // For custom frequency, we'll let BullMQ handle the scheduling
      return startDate;
    default:
      logger.warn(`Unknown job frequency: ${job.frequency}, treating as ONCE`);
      // Fallback to ONCE for unknown frequencies
      return startDate;
  }

  return nextRun;
}

export class Scheduler {
  private static instance: Scheduler;

  private constructor() {}

  public static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  public async start() {
    try {
      // Initialize any necessary startup tasks
      logger.info('Scheduler started successfully');
    } catch (error) {
      logger.error('Failed to start scheduler:', error);
      throw error;
    }
  }

  public async stop() {
    try {
      // Cleanup any necessary resources
      logger.info('Scheduler stopped successfully');
    } catch (error) {
      logger.error('Failed to stop scheduler:', error);
      throw error;
    }
  }
}

export const scheduler = Scheduler.getInstance(); 