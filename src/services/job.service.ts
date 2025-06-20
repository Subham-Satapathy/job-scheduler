import { eq, and, gte, lte, desc, sql, isNull } from 'drizzle-orm';
import { Queue } from 'bullmq';
import db from '../db';
import { jobs } from '../db/schema';
import { Job, JobStatus, JobFrequency } from '../types/job';
import { calculateNextRun } from '../utils/scheduler';
import { logger } from '../utils/logger';
import { defaultQueueOptions, QUEUE_NAMES } from '../config/bullmq.config';
import { cacheService } from './cache.service';
import { generateJobHash, DuplicateCheckFields } from '../utils/jobHash';

// Helper function to ensure job data is properly typed
function mapDbRowToJob(job: any): Job {
  return {
    id: job.id,
    name: job.name,
    description: job.description,
    status: dbStringToStatus(job.status),
    enabled: Boolean(job.enabled),
    frequency: dbStringToFrequency(job.frequency),
    cronExpression: job.cronExpression,
    startDate: new Date(job.startDate),
    endDate: job.endDate ? new Date(job.endDate) : null,
    lastRunAt: job.lastRunAt ? new Date(job.lastRunAt) : null,
    nextRunAt: job.nextRunAt ? new Date(job.nextRunAt) : null,
    data: job.data,
    dataHash: job.dataHash,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    createdAt: new Date(job.createdAt),
    updatedAt: new Date(job.updatedAt),
  };
}

// Helper functions to convert enums to database string values
function convertStatusToDbString(status: JobStatus): 'pending' | 'running' | 'completed' | 'failed' {
  switch (status) {
    case JobStatus.PENDING:
      return 'pending';
    case JobStatus.RUNNING:
      return 'running';
    case JobStatus.COMPLETED:
      return 'completed';
    case JobStatus.FAILED:
      return 'failed';
    case JobStatus.CANCELLED:
      return 'failed'; // Map cancelled to failed for database
    default:
      return 'pending';
  }
}

function frequencyToDbString(frequency: JobFrequency): 'once' | 'daily' | 'weekly' | 'monthly' | 'custom' {
  switch (frequency) {
    case JobFrequency.ONCE:
      return 'once';
    case JobFrequency.DAILY:
      return 'daily';
    case JobFrequency.WEEKLY:
      return 'weekly';
    case JobFrequency.MONTHLY:
      return 'monthly';
    case JobFrequency.CUSTOM:
      return 'custom';
    default:
      return 'once';
  }
}

// Helper functions to convert between database and application types
function dbStringToStatus(status: string): JobStatus {
  switch (status.toUpperCase()) {
    case 'PENDING': return JobStatus.PENDING;
    case 'RUNNING': return JobStatus.RUNNING;
    case 'COMPLETED': return JobStatus.COMPLETED;
    case 'FAILED': return JobStatus.FAILED;
    case 'CANCELLED': return JobStatus.CANCELLED;
    default:
      logger.warn(`Unknown job status from database: ${status}, defaulting to PENDING`);
      return JobStatus.PENDING;
  }
}

function dbStringToFrequency(frequency: string): JobFrequency {
  // Normalize to uppercase for backward compatibility
  const normalizedFrequency = frequency.toString().toUpperCase();
  
  switch (normalizedFrequency) {
    case 'ONCE': return JobFrequency.ONCE;
    case 'DAILY': return JobFrequency.DAILY;
    case 'WEEKLY': return JobFrequency.WEEKLY;
    case 'MONTHLY': return JobFrequency.MONTHLY;
    case 'CUSTOM': return JobFrequency.CUSTOM;
    default:
      logger.warn(`Unknown job frequency from database: ${frequency}, defaulting to ONCE`);
      return JobFrequency.ONCE;
  }
}

export class JobService {
  private queue: Queue;

  // Cache TTL constants (in seconds)
  private static readonly CACHE_TTL = {
    INDIVIDUAL_JOB: 900, // 15 minutes
    JOB_LIST: 300,       // 5 minutes
    UPCOMING_JOBS: 180,  // 3 minutes
  };

  // Cache key prefixes
  private static readonly CACHE_KEYS = {
    JOB: 'job',
    JOBS_ALL: 'jobs:all',
    JOBS_UPCOMING: 'jobs:upcoming',
    DUPLICATE_CHECK: 'job:duplicate',
  };

  constructor() {
    this.queue = new Queue(QUEUE_NAMES.JOB_QUEUE, defaultQueueOptions);
  }

  async initializeJobs() {
    try {
      logger.info('Initializing jobs...');
      const activeJobs = await db.select().from(jobs).where(
        and(
          eq(jobs.status, convertStatusToDbString(JobStatus.PENDING)),
          eq(jobs.enabled, true)
        )
      );
      logger.info(`Found ${activeJobs.length} pending and enabled jobs to initialize`);
      
      for (const job of activeJobs.map(mapDbRowToJob)) {
        await this.scheduleJob(job);
      }
      
      logger.info('Job initialization completed successfully');
    } catch (error) {
      logger.error('Failed to initialize jobs:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        details: error
      });
      throw new Error('Failed to initialize jobs. Application cannot start without proper job initialization.');
    }
  }

  private async scheduleJob(job: Job) {
    const safeJob = mapDbRowToJob(job);
    
    // Skip scheduling if job is disabled
    if (!safeJob.enabled) {
      logger.info('Skipping scheduling for disabled job', { 
        jobId: safeJob.id, 
        jobName: safeJob.name,
        enabled: safeJob.enabled 
      });
      return;
    }
    
    const nextRunAt = calculateNextRun(safeJob);

    if (safeJob.frequency === JobFrequency.ONCE) {
      const delay = nextRunAt.getTime() - Date.now();
      if (delay > 0) {
        await this.queue.add(
          `job-${safeJob.id}`,
          safeJob,
          {
            delay,
            jobId: safeJob.id.toString(),
          }
        );
        logger.debug('Scheduled one-time job', { 
          jobId: safeJob.id, 
          jobName: safeJob.name,
          delay,
          executeAt: nextRunAt.toISOString()
        });
      }
      return;
    }

    // For recurring jobs, use BullMQ's repeatable jobs
    const cronExpression = this.getCronExpression(safeJob);
    if (cronExpression) {
      await this.queue.add(
        `job-${safeJob.id}`,
        safeJob,
        {
          repeat: {
            pattern: cronExpression,
          },
          jobId: safeJob.id.toString(),
        }
      );
      logger.debug('Scheduled recurring job', { 
        jobId: safeJob.id, 
        jobName: safeJob.name,
        cronExpression,
        frequency: safeJob.frequency
      });
    }
  }

  private getCronExpression(job: Job): string | null {
    if (job.cronExpression) {
      return job.cronExpression;
    }

    switch (job.frequency) {
      case JobFrequency.DAILY:
        return '0 0 * * *'; // Every day at midnight
      case JobFrequency.WEEKLY:
        return '0 0 * * 0'; // Every Sunday at midnight
      case JobFrequency.MONTHLY:
        return '0 0 1 * *'; // First day of every month at midnight
      default:
        return null;
    }
  }

  /**
   * Check if a job with the same content already exists
   * Uses cache-first strategy for performance
   * 
   * @param fields The fields to check for duplicates
   * @returns The existing job if duplicate found, null otherwise
   */
  async checkForDuplicate(fields: DuplicateCheckFields): Promise<Job | null> {
    const startTime = performance.now();
    const dataHash = generateJobHash(fields);
    const cacheKey = `${JobService.CACHE_KEYS.DUPLICATE_CHECK}:${dataHash}`;
    
    try {
      // Check cache first for ultra-fast duplicate detection
      const cacheStartTime = performance.now();
      const cachedJob = await cacheService.get(cacheKey);
      const cacheTime = performance.now() - cacheStartTime;
      
      if (cachedJob) {
        const totalTime = performance.now() - startTime;
        const job = typeof cachedJob === 'string' ? JSON.parse(cachedJob) : cachedJob;
        
        logger.debug('Duplicate check cache hit', {
          hash: dataHash,
          cacheTimeMs: cacheTime,
          totalTimeMs: totalTime,
          jobId: job.id
        });
        return mapDbRowToJob(job);
      }
      
      // Cache miss - check database with retry logic for high load
      const dbStartTime = performance.now();
      let lastError: Error | null = null;
      
      // Retry database query up to 3 times for connection issues
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const existingJobs = await Promise.race([
            db.select().from(jobs)
              .where(and(
                eq(jobs.name, fields.name),
                eq(jobs.frequency, frequencyToDbString(fields.frequency)),
                fields.cronExpression === null 
                  ? isNull(jobs.cronExpression)
                  : eq(jobs.cronExpression, fields.cronExpression),
                eq(jobs.dataHash, dataHash)
              ))
              .limit(1),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Database query timeout')), 5000)
            )
          ]) as any[];
          
          const dbTime = performance.now() - dbStartTime;
          const totalTime = performance.now() - startTime;
          
          if (existingJobs.length > 0) {
            const job = mapDbRowToJob(existingJobs[0]);
            
            // Cache the result for future lookups (24 hour TTL)
            await cacheService.set(cacheKey, JSON.stringify(job), JobService.CACHE_TTL.INDIVIDUAL_JOB * 96); // 24 hours
            
            logger.info('Duplicate job detected', {
              hash: dataHash,
              existingJobId: job.id,
              existingJobName: job.name,
              dbTimeMs: dbTime,
              totalTimeMs: totalTime,
              attempt
            });
            
            return job;
          }
          
          logger.debug('No duplicate found', {
            hash: dataHash,
            dbTimeMs: dbTime,
            totalTimeMs: totalTime,
            attempt
          });
          
          return null;
          
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt < 3) {
            // Wait with exponential backoff before retrying
            const delay = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms
            await new Promise(resolve => setTimeout(resolve, delay));
            
            logger.warn(`Duplicate check attempt ${attempt} failed, retrying in ${delay}ms`, {
              error: lastError.message,
              hash: dataHash,
              attempt
            });
            continue;
          }
        }
      }
      
      // All retries failed
      throw lastError;
      
    } catch (error) {
      const totalTime = performance.now() - startTime;
      
      // Record error metrics but with more context
      logger.error('Duplicate check failed after all retries', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hash: dataHash,
        totalTimeMs: totalTime,
        jobName: fields.name,
        frequency: fields.frequency,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Return null on error to allow job creation (fail-open strategy)
      // This prevents duplicate check failures from blocking job creation entirely
      return null;
    }
  }

  async createJob(jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'dataHash'>, options?: { forceCreate?: boolean }): Promise<Job> {
    const startTime = performance.now();
    
    // Check for duplicates unless forced
    if (!options?.forceCreate) {
      const duplicateCheckFields: DuplicateCheckFields = {
        name: jobData.name,
        frequency: jobData.frequency,
        cronExpression: jobData.cronExpression,
        data: jobData.data
      };
      
      const existingJob = await this.checkForDuplicate(duplicateCheckFields);
      if (existingJob) {
        const totalTime = performance.now() - startTime;
        logger.warn('Attempted to create duplicate job', {
          existingJobId: existingJob.id,
          requestedJobName: jobData.name,
          totalTimeMs: totalTime
        });
        
        // Create a custom error for duplicate detection
        const error = new Error(`Duplicate job detected. Job with same name, frequency, and data already exists.`) as any;
        error.code = 'DUPLICATE_JOB';
        error.existingJob = existingJob;
        throw error;
      }
    }
    
    // Generate hash for the new job
    const dataHash = generateJobHash({
      name: jobData.name,
      frequency: jobData.frequency,
      cronExpression: jobData.cronExpression,
      data: jobData.data
    });
    
    // Prepare data for database insertion with proper type conversion
    const insertData = {
      ...jobData,
      frequency: frequencyToDbString(jobData.frequency),
      status: convertStatusToDbString(jobData.status || JobStatus.PENDING),
      dataHash,
      nextRunAt: calculateNextRun(jobData as Job),
    };
    
    const [job] = await db.insert(jobs).values(insertData).returning();
    
    const safeJob = mapDbRowToJob(job);
    
    // Cache the new job for future duplicate checks
    const cacheKey = `${JobService.CACHE_KEYS.DUPLICATE_CHECK}:${dataHash}`;
    await cacheService.set(cacheKey, JSON.stringify(safeJob), JobService.CACHE_TTL.INDIVIDUAL_JOB * 96); // 24 hours
    
    await this.scheduleJob(safeJob);
    
    // Invalidate list caches since we added a new job
    await cacheService.invalidateJobListCaches();
    
    const totalTime = performance.now() - startTime;
    logger.info('Created new job', { 
      jobId: safeJob.id, 
      name: safeJob.name,
      dataHash,
      forceCreate: options?.forceCreate || false,
      totalTimeMs: totalTime
    });
    
    return safeJob;
  }

  async updateJob(id: number, jobData: Partial<Job>): Promise<Job | null> {
    // Prepare update data with proper type conversion
    const updateData: any = {
      ...jobData,
      updatedAt: new Date(),
    };
    
    // Convert enum fields to strings for database
    if (jobData.frequency) {
      updateData.frequency = frequencyToDbString(jobData.frequency);
      updateData.nextRunAt = calculateNextRun(jobData as Job);
    }
    
    if (jobData.status) {
      updateData.status = convertStatusToDbString(jobData.status);
    }
    
    const result = await db
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id))
      .returning();

    if (result.length > 0) {
      const safeJob = mapDbRowToJob(result[0]);
      
      // Remove existing job from queue
      await this.queue.removeJobScheduler(`job-${id}`);
      
      // Invalidate all related caches
      await cacheService.invalidateAllJobCaches(id);
      
      // Schedule updated job
      await this.scheduleJob(safeJob);
      
      logger.info('Updated job', { jobId: id, changes: Object.keys(jobData) });
      
      return safeJob;
    }
    return null;
  }

  async deleteJob(id: number): Promise<boolean> {
    const result = await db
      .delete(jobs)
      .where(eq(jobs.id, id))
      .returning();

    if (result.length > 0) {
      // Remove job from queue
      await this.queue.removeJobScheduler(`job-${id}`);
      
      // Invalidate all related caches
      await cacheService.invalidateAllJobCaches(id);
      
      logger.info('Deleted job', { jobId: id });
      
      return true;
    }
    return false;
  }

  async getJobById(id: number): Promise<Job | null> {
    const startTime = performance.now();
    const cacheKey = `${JobService.CACHE_KEYS.JOB}:${id}`;
    
    // Try to get from cache first
    const cacheStartTime = performance.now();
    const cachedJob = await cacheService.get(cacheKey);
    const cacheTime = performance.now() - cacheStartTime;
    
    if (cachedJob) {
      const executionTime = performance.now() - startTime;
      logger.debug('getJobById cache hit', { 
        jobId: id, 
        totalExecutionTimeMs: executionTime,
        cacheLookupTimeMs: cacheTime
      });
      return mapDbRowToJob(JSON.parse(cachedJob));
    }
    
    // If not in cache, get from database
    const dbStartTime = performance.now();
    try {
      const result = await db
        .select({
          id: jobs.id,
          name: jobs.name,
          description: jobs.description,
          status: jobs.status,
          enabled: jobs.enabled,
          frequency: jobs.frequency,
          cronExpression: jobs.cronExpression,
          startDate: jobs.startDate,
          endDate: jobs.endDate,
          lastRunAt: jobs.lastRunAt,
          nextRunAt: jobs.nextRunAt,
          data: jobs.data,
          retryCount: jobs.retryCount,
          maxRetries: jobs.maxRetries,
          dataHash: jobs.dataHash,
          createdAt: jobs.createdAt,
          updatedAt: jobs.updatedAt
        })
        .from(jobs)
        .where(eq(jobs.id, id))
        .limit(1);
      
      const dbTime = performance.now() - dbStartTime;
      
      if (result.length === 0) {
        const executionTime = performance.now() - startTime;
        logger.debug('getJobById not found', { 
          jobId: id, 
          totalExecutionTimeMs: executionTime,
          dbQueryTimeMs: dbTime
        });
        return null;
      }
      
      const transformStartTime = performance.now();
      const job = mapDbRowToJob(result[0]);
      const transformTime = performance.now() - transformStartTime;
      
      // Cache the result
      const cacheSetStartTime = performance.now();
      await cacheService.set(cacheKey, JSON.stringify(job), JobService.CACHE_TTL.INDIVIDUAL_JOB);
      const cacheSetTime = performance.now() - cacheSetStartTime;
      
      const executionTime = performance.now() - startTime;
      logger.debug('getJobById performance metrics', { 
        jobId: id,
        totalExecutionTimeMs: executionTime,
        cacheLookupTimeMs: cacheTime,
        dbQueryTimeMs: dbTime,
        transformTimeMs: transformTime,
        cacheSetTimeMs: cacheSetTime,
        cacheMiss: true
      });
      
      return job;
    } catch (error) {
      const dbTime = performance.now() - dbStartTime;
      logger.error('getJobById database error', {
        jobId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        dbQueryTimeMs: dbTime
      });
      throw error;
    }
  }

  async getAllJobs(page: number = 1, limit: number = 10, status?: JobStatus): Promise<{ jobs: Job[]; total: number }> {
    const startTime = performance.now();
    const statusKey = status || 'all';
    const cacheKey = `${JobService.CACHE_KEYS.JOBS_ALL}:${page}:${limit}:${statusKey}`;
    
    // Try to get from cache first
    const cacheStartTime = performance.now();
    const cachedResult = await cacheService.get(cacheKey);
    const cacheTime = performance.now() - cacheStartTime;
    
    if (cachedResult) {
      const executionTime = performance.now() - startTime;
      logger.debug('getAllJobs cache hit', { 
        page, 
        limit, 
        status: statusKey,
        totalExecutionTimeMs: executionTime,
        cacheLookupTimeMs: cacheTime
      });
      const parsed = JSON.parse(cachedResult);
      return {
        jobs: parsed.jobs.map(mapDbRowToJob),
        total: parsed.total
      };
    }
    
    // If not in cache, get from database
    const dbStartTime = performance.now();
    try {
      const offset = (page - 1) * limit;
      const whereClause = status ? eq(jobs.status, convertStatusToDbString(status)) : undefined;

      const [jobsList, total] = await Promise.all([
        db
          .select()
          .from(jobs)
          .where(whereClause)
          .orderBy(desc(jobs.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(jobs)
          .where(whereClause)
          .then(result => Number(result[0].count))
      ]);

      const dbTime = performance.now() - dbStartTime;
      
      const transformStartTime = performance.now();
      const result = {
        jobs: jobsList.map(mapDbRowToJob),
        total,
      };
      const transformTime = performance.now() - transformStartTime;
      
      // Cache the result
      const cacheSetStartTime = performance.now();
      await cacheService.set(cacheKey, JSON.stringify(result), JobService.CACHE_TTL.JOB_LIST);
      const cacheSetTime = performance.now() - cacheSetStartTime;
      
      const executionTime = performance.now() - startTime;
      logger.debug('getAllJobs performance metrics', { 
        page,
        limit,
        status: statusKey,
        resultCount: result.jobs.length,
        totalExecutionTimeMs: executionTime,
        cacheLookupTimeMs: cacheTime,
        dbQueryTimeMs: dbTime,
        transformTimeMs: transformTime,
        cacheSetTimeMs: cacheSetTime,
        cacheMiss: true
      });
      
      return result;
    } catch (error) {
      const dbTime = performance.now() - dbStartTime;
      logger.error('getAllJobs database error', {
        page,
        limit,
        status: statusKey,
        error: error instanceof Error ? error.message : 'Unknown error',
        dbQueryTimeMs: dbTime
      });
      throw error;
    }
  }

  async getUpcomingJobs(limit: number = 10): Promise<Job[]> {
    const startTime = performance.now();
    const cacheKey = `${JobService.CACHE_KEYS.JOBS_UPCOMING}:${limit}`;
    
    // Try to get from cache first
    const cacheStartTime = performance.now();
    const cachedJobs = await cacheService.get(cacheKey);
    const cacheTime = performance.now() - cacheStartTime;
    
    if (cachedJobs) {
      const executionTime = performance.now() - startTime;
      logger.debug('getUpcomingJobs cache hit', { 
        limit,
        totalExecutionTimeMs: executionTime,
        cacheLookupTimeMs: cacheTime
      });
      return JSON.parse(cachedJobs).map(mapDbRowToJob);
    }
    
    // If not in cache, get from database
    const dbStartTime = performance.now();
    try {
      const jobsList = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.status, convertStatusToDbString(JobStatus.PENDING)),
            eq(jobs.enabled, true),
            gte(jobs.nextRunAt!, new Date())
          )
        )
        .orderBy(jobs.nextRunAt)
        .limit(limit);
      
      const dbTime = performance.now() - dbStartTime;
      
      const transformStartTime = performance.now();
      const result = jobsList.map(mapDbRowToJob);
      const transformTime = performance.now() - transformStartTime;
      
      // Cache the result
      const cacheSetStartTime = performance.now();
      await cacheService.set(cacheKey, JSON.stringify(result), JobService.CACHE_TTL.UPCOMING_JOBS);
      const cacheSetTime = performance.now() - cacheSetStartTime;
      
      const executionTime = performance.now() - startTime;
      logger.debug('getUpcomingJobs performance metrics', { 
        limit,
        resultCount: result.length,
        totalExecutionTimeMs: executionTime,
        cacheLookupTimeMs: cacheTime,
        dbQueryTimeMs: dbTime,
        transformTimeMs: transformTime,
        cacheSetTimeMs: cacheSetTime,
        cacheMiss: true
      });
      
      return result;
    } catch (error) {
      const dbTime = performance.now() - dbStartTime;
      logger.error('getUpcomingJobs database error', {
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
        dbQueryTimeMs: dbTime
      });
      throw error;
    }
  }

  async enableJob(id: number): Promise<Job | null> {
    const result = await db
      .update(jobs)
      .set({
        enabled: true,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id))
      .returning();

    if (result.length > 0) {
      const safeJob = mapDbRowToJob(result[0]);
      
      // Invalidate all related caches
      await cacheService.invalidateAllJobCaches(id);
      
      // Schedule the enabled job if it's pending
      if (safeJob.status === JobStatus.PENDING) {
        await this.scheduleJob(safeJob);
      }
      
      logger.info('Job enabled', { 
        jobId: id, 
        jobName: safeJob.name,
        status: safeJob.status
      });
      
      return safeJob;
    }
    return null;
  }

  async disableJob(id: number): Promise<Job | null> {
    const result = await db
      .update(jobs)
      .set({
        enabled: false,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id))
      .returning();

    if (result.length > 0) {
      const safeJob = mapDbRowToJob(result[0]);
      
      // Remove job from queue since it's disabled
      await this.queue.removeJobScheduler(`job-${id}`);
      
      // Invalidate all related caches
      await cacheService.invalidateAllJobCaches(id);
      
      logger.info('Job disabled and removed from queue', { 
        jobId: id, 
        jobName: safeJob.name,
        status: safeJob.status
      });
      
      return safeJob;
    }
    return null;
  }

  async incrementRetryCount(id: number): Promise<Job | null> {
    const current = await this.getJobById(id);
    if (!current) return null;
    
    const [job] = await db
      .update(jobs)
      .set({
        retryCount: current.retryCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id))
      .returning();
    
    if (job) {
      const safeJob = mapDbRowToJob(job);
      
      // Invalidate all job caches since retry count changed
      await cacheService.invalidateAllJobCaches(id);
      
      logger.info('Incremented retry count', { 
        jobId: id, 
        newRetryCount: safeJob.retryCount 
      });
      
      return safeJob;
    }
    
    return null;
  }

  async close(): Promise<void> {
    await this.queue.close();
    logger.info('Job service closed');
  }
}

export const jobService = new JobService(); 