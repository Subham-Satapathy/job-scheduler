"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobService = exports.JobService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const bullmq_1 = require("bullmq");
const db_1 = __importDefault(require("../db"));
const schema_1 = require("../db/schema");
const job_1 = require("../types/job");
const scheduler_1 = require("../utils/scheduler");
const logger_1 = require("../utils/logger");
const bullmq_config_1 = require("../config/bullmq.config");
const cache_service_1 = require("./cache.service");
const jobHash_1 = require("../utils/jobHash");
// Helper function to ensure job data is properly typed
function toJob(job) {
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
function statusToDbString(status) {
    switch (status) {
        case job_1.JobStatus.PENDING:
            return 'pending';
        case job_1.JobStatus.RUNNING:
            return 'running';
        case job_1.JobStatus.COMPLETED:
            return 'completed';
        case job_1.JobStatus.FAILED:
            return 'failed';
        case job_1.JobStatus.CANCELLED:
            return 'failed'; // Map cancelled to failed for database
        default:
            return 'pending';
    }
}
function frequencyToDbString(frequency) {
    switch (frequency) {
        case job_1.JobFrequency.ONCE:
            return 'once';
        case job_1.JobFrequency.DAILY:
            return 'daily';
        case job_1.JobFrequency.WEEKLY:
            return 'weekly';
        case job_1.JobFrequency.MONTHLY:
            return 'monthly';
        case job_1.JobFrequency.CUSTOM:
            return 'custom';
        default:
            return 'once';
    }
}
// Helper functions to convert between database and application types
function dbStringToStatus(status) {
    switch (status.toUpperCase()) {
        case 'PENDING': return job_1.JobStatus.PENDING;
        case 'RUNNING': return job_1.JobStatus.RUNNING;
        case 'COMPLETED': return job_1.JobStatus.COMPLETED;
        case 'FAILED': return job_1.JobStatus.FAILED;
        case 'CANCELLED': return job_1.JobStatus.CANCELLED;
        default:
            logger_1.logger.warn(`Unknown job status from database: ${status}, defaulting to PENDING`);
            return job_1.JobStatus.PENDING;
    }
}
function dbStringToFrequency(frequency) {
    // Normalize to uppercase for backward compatibility
    const normalizedFrequency = frequency.toString().toUpperCase();
    switch (normalizedFrequency) {
        case 'ONCE': return job_1.JobFrequency.ONCE;
        case 'DAILY': return job_1.JobFrequency.DAILY;
        case 'WEEKLY': return job_1.JobFrequency.WEEKLY;
        case 'MONTHLY': return job_1.JobFrequency.MONTHLY;
        case 'CUSTOM': return job_1.JobFrequency.CUSTOM;
        default:
            logger_1.logger.warn(`Unknown job frequency from database: ${frequency}, defaulting to ONCE`);
            return job_1.JobFrequency.ONCE;
    }
}
class JobService {
    constructor() {
        this.queue = new bullmq_1.Queue(bullmq_config_1.QUEUE_NAMES.JOB_QUEUE, bullmq_config_1.defaultQueueOptions);
    }
    async initializeJobs() {
        try {
            logger_1.logger.info('Initializing jobs...');
            const activeJobs = await db_1.default.select().from(schema_1.jobs).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.jobs.status, statusToDbString(job_1.JobStatus.PENDING)), (0, drizzle_orm_1.eq)(schema_1.jobs.enabled, true)));
            logger_1.logger.info(`Found ${activeJobs.length} pending and enabled jobs to initialize`);
            for (const job of activeJobs.map(toJob)) {
                await this.scheduleJob(job);
            }
            logger_1.logger.info('Job initialization completed successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize jobs:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                details: error
            });
            throw new Error('Failed to initialize jobs. Application cannot start without proper job initialization.');
        }
    }
    async scheduleJob(job) {
        const safeJob = toJob(job);
        // Skip scheduling if job is disabled
        if (!safeJob.enabled) {
            logger_1.logger.info('Skipping scheduling for disabled job', {
                jobId: safeJob.id,
                jobName: safeJob.name,
                enabled: safeJob.enabled
            });
            return;
        }
        const nextRunAt = (0, scheduler_1.calculateNextRun)(safeJob);
        if (safeJob.frequency === job_1.JobFrequency.ONCE) {
            const delay = nextRunAt.getTime() - Date.now();
            if (delay > 0) {
                await this.queue.add(`job-${safeJob.id}`, safeJob, {
                    delay,
                    jobId: safeJob.id.toString(),
                });
                logger_1.logger.debug('Scheduled one-time job', {
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
            await this.queue.add(`job-${safeJob.id}`, safeJob, {
                repeat: {
                    pattern: cronExpression,
                },
                jobId: safeJob.id.toString(),
            });
            logger_1.logger.debug('Scheduled recurring job', {
                jobId: safeJob.id,
                jobName: safeJob.name,
                cronExpression,
                frequency: safeJob.frequency
            });
        }
    }
    getCronExpression(job) {
        if (job.cronExpression) {
            return job.cronExpression;
        }
        switch (job.frequency) {
            case job_1.JobFrequency.DAILY:
                return '0 0 * * *'; // Every day at midnight
            case job_1.JobFrequency.WEEKLY:
                return '0 0 * * 0'; // Every Sunday at midnight
            case job_1.JobFrequency.MONTHLY:
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
    async checkForDuplicate(fields) {
        const startTime = performance.now();
        const dataHash = (0, jobHash_1.generateJobHash)(fields);
        const cacheKey = `${JobService.CACHE_KEYS.DUPLICATE_CHECK}:${dataHash}`;
        try {
            // Check cache first for ultra-fast duplicate detection
            const cacheStartTime = performance.now();
            const cachedJob = await cache_service_1.cacheService.get(cacheKey);
            const cacheTime = performance.now() - cacheStartTime;
            if (cachedJob) {
                const totalTime = performance.now() - startTime;
                const job = typeof cachedJob === 'string' ? JSON.parse(cachedJob) : cachedJob;
                logger_1.logger.debug('Duplicate check cache hit', {
                    hash: dataHash,
                    cacheTimeMs: cacheTime,
                    totalTimeMs: totalTime,
                    jobId: job.id
                });
                return toJob(job);
            }
            // Cache miss - check database with retry logic for high load
            const dbStartTime = performance.now();
            let lastError = null;
            // Retry database query up to 3 times for connection issues
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const existingJobs = await Promise.race([
                        db_1.default.select().from(schema_1.jobs)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.jobs.name, fields.name), (0, drizzle_orm_1.eq)(schema_1.jobs.frequency, frequencyToDbString(fields.frequency)), fields.cronExpression === null
                            ? (0, drizzle_orm_1.isNull)(schema_1.jobs.cronExpression)
                            : (0, drizzle_orm_1.eq)(schema_1.jobs.cronExpression, fields.cronExpression), (0, drizzle_orm_1.eq)(schema_1.jobs.dataHash, dataHash)))
                            .limit(1),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 5000))
                    ]);
                    const dbTime = performance.now() - dbStartTime;
                    const totalTime = performance.now() - startTime;
                    if (existingJobs.length > 0) {
                        const job = toJob(existingJobs[0]);
                        // Cache the result for future lookups (24 hour TTL)
                        await cache_service_1.cacheService.set(cacheKey, JSON.stringify(job), JobService.CACHE_TTL.INDIVIDUAL_JOB * 96); // 24 hours
                        logger_1.logger.info('Duplicate job detected', {
                            hash: dataHash,
                            existingJobId: job.id,
                            existingJobName: job.name,
                            dbTimeMs: dbTime,
                            totalTimeMs: totalTime,
                            attempt
                        });
                        return job;
                    }
                    logger_1.logger.debug('No duplicate found', {
                        hash: dataHash,
                        dbTimeMs: dbTime,
                        totalTimeMs: totalTime,
                        attempt
                    });
                    return null;
                }
                catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    if (attempt < 3) {
                        // Wait with exponential backoff before retrying
                        const delay = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms
                        await new Promise(resolve => setTimeout(resolve, delay));
                        logger_1.logger.warn(`Duplicate check attempt ${attempt} failed, retrying in ${delay}ms`, {
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
        }
        catch (error) {
            const totalTime = performance.now() - startTime;
            // Record error metrics but with more context
            logger_1.logger.error('Duplicate check failed after all retries', {
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
    async createJob(jobData, options) {
        const startTime = performance.now();
        // Check for duplicates unless forced
        if (!options?.forceCreate) {
            const duplicateCheckFields = {
                name: jobData.name,
                frequency: jobData.frequency,
                cronExpression: jobData.cronExpression,
                data: jobData.data
            };
            const existingJob = await this.checkForDuplicate(duplicateCheckFields);
            if (existingJob) {
                const totalTime = performance.now() - startTime;
                logger_1.logger.warn('Attempted to create duplicate job', {
                    existingJobId: existingJob.id,
                    requestedJobName: jobData.name,
                    totalTimeMs: totalTime
                });
                // Create a custom error for duplicate detection
                const error = new Error(`Duplicate job detected. Job with same name, frequency, and data already exists.`);
                error.code = 'DUPLICATE_JOB';
                error.existingJob = existingJob;
                throw error;
            }
        }
        // Generate hash for the new job
        const dataHash = (0, jobHash_1.generateJobHash)({
            name: jobData.name,
            frequency: jobData.frequency,
            cronExpression: jobData.cronExpression,
            data: jobData.data
        });
        // Prepare data for database insertion with proper type conversion
        const insertData = {
            ...jobData,
            frequency: frequencyToDbString(jobData.frequency),
            status: statusToDbString(jobData.status || job_1.JobStatus.PENDING),
            dataHash,
            nextRunAt: (0, scheduler_1.calculateNextRun)(jobData),
        };
        const [job] = await db_1.default.insert(schema_1.jobs).values(insertData).returning();
        const safeJob = toJob(job);
        // Cache the new job for future duplicate checks
        const cacheKey = `${JobService.CACHE_KEYS.DUPLICATE_CHECK}:${dataHash}`;
        await cache_service_1.cacheService.set(cacheKey, JSON.stringify(safeJob), JobService.CACHE_TTL.INDIVIDUAL_JOB * 96); // 24 hours
        await this.scheduleJob(safeJob);
        // Invalidate list caches since we added a new job
        await cache_service_1.cacheService.invalidateJobListCaches();
        const totalTime = performance.now() - startTime;
        logger_1.logger.info('Created new job', {
            jobId: safeJob.id,
            name: safeJob.name,
            dataHash,
            forceCreate: options?.forceCreate || false,
            totalTimeMs: totalTime
        });
        return safeJob;
    }
    async updateJob(id, jobData) {
        // Prepare update data with proper type conversion
        const updateData = {
            ...jobData,
            updatedAt: new Date(),
        };
        // Convert enum fields to strings for database
        if (jobData.frequency) {
            updateData.frequency = frequencyToDbString(jobData.frequency);
            updateData.nextRunAt = (0, scheduler_1.calculateNextRun)(jobData);
        }
        if (jobData.status) {
            updateData.status = statusToDbString(jobData.status);
        }
        const result = await db_1.default
            .update(schema_1.jobs)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id))
            .returning();
        if (result.length > 0) {
            const safeJob = toJob(result[0]);
            // Remove existing job from queue
            await this.queue.removeJobScheduler(`job-${id}`);
            // Invalidate all related caches
            await cache_service_1.cacheService.invalidateAllJobCaches(id);
            // Schedule updated job
            await this.scheduleJob(safeJob);
            logger_1.logger.info('Updated job', { jobId: id, changes: Object.keys(jobData) });
            return safeJob;
        }
        return null;
    }
    async deleteJob(id) {
        const result = await db_1.default
            .delete(schema_1.jobs)
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id))
            .returning();
        if (result.length > 0) {
            // Remove job from queue
            await this.queue.removeJobScheduler(`job-${id}`);
            // Invalidate all related caches
            await cache_service_1.cacheService.invalidateAllJobCaches(id);
            logger_1.logger.info('Deleted job', { jobId: id });
            return true;
        }
        return false;
    }
    async getJobById(id) {
        const startTime = performance.now();
        const cacheKey = `${JobService.CACHE_KEYS.JOB}:${id}`;
        // Try to get from cache first
        const cacheStartTime = performance.now();
        const cachedJob = await cache_service_1.cacheService.get(cacheKey);
        const cacheTime = performance.now() - cacheStartTime;
        if (cachedJob) {
            const executionTime = performance.now() - startTime;
            logger_1.logger.debug('getJobById cache hit', {
                jobId: id,
                totalExecutionTimeMs: executionTime,
                cacheLookupTimeMs: cacheTime
            });
            return toJob(JSON.parse(cachedJob));
        }
        // If not in cache, get from database
        const dbStartTime = performance.now();
        try {
            const result = await db_1.default
                .select({
                id: schema_1.jobs.id,
                name: schema_1.jobs.name,
                description: schema_1.jobs.description,
                status: schema_1.jobs.status,
                enabled: schema_1.jobs.enabled,
                frequency: schema_1.jobs.frequency,
                cronExpression: schema_1.jobs.cronExpression,
                startDate: schema_1.jobs.startDate,
                endDate: schema_1.jobs.endDate,
                lastRunAt: schema_1.jobs.lastRunAt,
                nextRunAt: schema_1.jobs.nextRunAt,
                data: schema_1.jobs.data,
                retryCount: schema_1.jobs.retryCount,
                maxRetries: schema_1.jobs.maxRetries,
                dataHash: schema_1.jobs.dataHash,
                createdAt: schema_1.jobs.createdAt,
                updatedAt: schema_1.jobs.updatedAt
            })
                .from(schema_1.jobs)
                .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id))
                .limit(1);
            const dbTime = performance.now() - dbStartTime;
            if (result.length === 0) {
                const executionTime = performance.now() - startTime;
                logger_1.logger.debug('getJobById not found', {
                    jobId: id,
                    totalExecutionTimeMs: executionTime,
                    dbQueryTimeMs: dbTime
                });
                return null;
            }
            const transformStartTime = performance.now();
            const job = toJob(result[0]);
            const transformTime = performance.now() - transformStartTime;
            // Cache the result
            const cacheSetStartTime = performance.now();
            await cache_service_1.cacheService.set(cacheKey, JSON.stringify(job), JobService.CACHE_TTL.INDIVIDUAL_JOB);
            const cacheSetTime = performance.now() - cacheSetStartTime;
            const executionTime = performance.now() - startTime;
            logger_1.logger.debug('getJobById performance metrics', {
                jobId: id,
                totalExecutionTimeMs: executionTime,
                cacheLookupTimeMs: cacheTime,
                dbQueryTimeMs: dbTime,
                transformTimeMs: transformTime,
                cacheSetTimeMs: cacheSetTime,
                cacheMiss: true
            });
            return job;
        }
        catch (error) {
            const dbTime = performance.now() - dbStartTime;
            logger_1.logger.error('getJobById database error', {
                jobId: id,
                error: error instanceof Error ? error.message : 'Unknown error',
                dbQueryTimeMs: dbTime
            });
            throw error;
        }
    }
    async getAllJobs(page = 1, limit = 10, status) {
        const startTime = performance.now();
        const statusKey = status || 'all';
        const cacheKey = `${JobService.CACHE_KEYS.JOBS_ALL}:${page}:${limit}:${statusKey}`;
        // Try to get from cache first
        const cacheStartTime = performance.now();
        const cachedResult = await cache_service_1.cacheService.get(cacheKey);
        const cacheTime = performance.now() - cacheStartTime;
        if (cachedResult) {
            const executionTime = performance.now() - startTime;
            logger_1.logger.debug('getAllJobs cache hit', {
                page,
                limit,
                status: statusKey,
                totalExecutionTimeMs: executionTime,
                cacheLookupTimeMs: cacheTime
            });
            const parsed = JSON.parse(cachedResult);
            return {
                jobs: parsed.jobs.map(toJob),
                total: parsed.total
            };
        }
        // If not in cache, get from database
        const dbStartTime = performance.now();
        try {
            const offset = (page - 1) * limit;
            const whereClause = status ? (0, drizzle_orm_1.eq)(schema_1.jobs.status, statusToDbString(status)) : undefined;
            const [jobsList, total] = await Promise.all([
                db_1.default
                    .select()
                    .from(schema_1.jobs)
                    .where(whereClause)
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.jobs.createdAt))
                    .limit(limit)
                    .offset(offset),
                db_1.default
                    .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
                    .from(schema_1.jobs)
                    .where(whereClause)
                    .then(result => Number(result[0].count))
            ]);
            const dbTime = performance.now() - dbStartTime;
            const transformStartTime = performance.now();
            const result = {
                jobs: jobsList.map(toJob),
                total,
            };
            const transformTime = performance.now() - transformStartTime;
            // Cache the result
            const cacheSetStartTime = performance.now();
            await cache_service_1.cacheService.set(cacheKey, JSON.stringify(result), JobService.CACHE_TTL.JOB_LIST);
            const cacheSetTime = performance.now() - cacheSetStartTime;
            const executionTime = performance.now() - startTime;
            logger_1.logger.debug('getAllJobs performance metrics', {
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
        }
        catch (error) {
            const dbTime = performance.now() - dbStartTime;
            logger_1.logger.error('getAllJobs database error', {
                page,
                limit,
                status: statusKey,
                error: error instanceof Error ? error.message : 'Unknown error',
                dbQueryTimeMs: dbTime
            });
            throw error;
        }
    }
    async getUpcomingJobs(limit = 10) {
        const startTime = performance.now();
        const cacheKey = `${JobService.CACHE_KEYS.JOBS_UPCOMING}:${limit}`;
        // Try to get from cache first
        const cacheStartTime = performance.now();
        const cachedJobs = await cache_service_1.cacheService.get(cacheKey);
        const cacheTime = performance.now() - cacheStartTime;
        if (cachedJobs) {
            const executionTime = performance.now() - startTime;
            logger_1.logger.debug('getUpcomingJobs cache hit', {
                limit,
                totalExecutionTimeMs: executionTime,
                cacheLookupTimeMs: cacheTime
            });
            return JSON.parse(cachedJobs).map(toJob);
        }
        // If not in cache, get from database
        const dbStartTime = performance.now();
        try {
            const jobsList = await db_1.default
                .select()
                .from(schema_1.jobs)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.jobs.status, statusToDbString(job_1.JobStatus.PENDING)), (0, drizzle_orm_1.eq)(schema_1.jobs.enabled, true), (0, drizzle_orm_1.gte)(schema_1.jobs.nextRunAt, new Date())))
                .orderBy(schema_1.jobs.nextRunAt)
                .limit(limit);
            const dbTime = performance.now() - dbStartTime;
            const transformStartTime = performance.now();
            const result = jobsList.map(toJob);
            const transformTime = performance.now() - transformStartTime;
            // Cache the result
            const cacheSetStartTime = performance.now();
            await cache_service_1.cacheService.set(cacheKey, JSON.stringify(result), JobService.CACHE_TTL.UPCOMING_JOBS);
            const cacheSetTime = performance.now() - cacheSetStartTime;
            const executionTime = performance.now() - startTime;
            logger_1.logger.debug('getUpcomingJobs performance metrics', {
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
        }
        catch (error) {
            const dbTime = performance.now() - dbStartTime;
            logger_1.logger.error('getUpcomingJobs database error', {
                limit,
                error: error instanceof Error ? error.message : 'Unknown error',
                dbQueryTimeMs: dbTime
            });
            throw error;
        }
    }
    async enableJob(id) {
        const result = await db_1.default
            .update(schema_1.jobs)
            .set({
            enabled: true,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id))
            .returning();
        if (result.length > 0) {
            const safeJob = toJob(result[0]);
            // Invalidate all related caches
            await cache_service_1.cacheService.invalidateAllJobCaches(id);
            // Schedule the enabled job if it's pending
            if (safeJob.status === job_1.JobStatus.PENDING) {
                await this.scheduleJob(safeJob);
            }
            logger_1.logger.info('Job enabled', {
                jobId: id,
                jobName: safeJob.name,
                status: safeJob.status
            });
            return safeJob;
        }
        return null;
    }
    async disableJob(id) {
        const result = await db_1.default
            .update(schema_1.jobs)
            .set({
            enabled: false,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id))
            .returning();
        if (result.length > 0) {
            const safeJob = toJob(result[0]);
            // Remove job from queue since it's disabled
            await this.queue.removeJobScheduler(`job-${id}`);
            // Invalidate all related caches
            await cache_service_1.cacheService.invalidateAllJobCaches(id);
            logger_1.logger.info('Job disabled and removed from queue', {
                jobId: id,
                jobName: safeJob.name,
                status: safeJob.status
            });
            return safeJob;
        }
        return null;
    }
    async incrementRetryCount(id) {
        const current = await this.getJobById(id);
        if (!current)
            return null;
        const [job] = await db_1.default
            .update(schema_1.jobs)
            .set({
            retryCount: current.retryCount + 1,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id))
            .returning();
        if (job) {
            const safeJob = toJob(job);
            // Invalidate all job caches since retry count changed
            await cache_service_1.cacheService.invalidateAllJobCaches(id);
            logger_1.logger.info('Incremented retry count', {
                jobId: id,
                newRetryCount: safeJob.retryCount
            });
            return safeJob;
        }
        return null;
    }
    async close() {
        await this.queue.close();
        logger_1.logger.info('Job service closed');
    }
}
exports.JobService = JobService;
// Cache TTL constants (in seconds)
JobService.CACHE_TTL = {
    INDIVIDUAL_JOB: 900, // 15 minutes
    JOB_LIST: 300, // 5 minutes
    UPCOMING_JOBS: 180, // 3 minutes
};
// Cache key prefixes
JobService.CACHE_KEYS = {
    JOB: 'job',
    JOBS_ALL: 'jobs:all',
    JOBS_UPCOMING: 'jobs:upcoming',
    DUPLICATE_CHECK: 'job:duplicate',
};
exports.jobService = new JobService();
