"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobWorker = void 0;
const bullmq_1 = require("bullmq");
const job_1 = require("../types/job");
const logger_1 = require("../utils/logger");
const job_service_1 = require("../services/job.service");
const bullmq_config_1 = require("../config/bullmq.config");
const cache_service_1 = require("../services/cache.service");
class JobWorker {
    constructor() {
        this.worker = new bullmq_1.Worker(bullmq_config_1.QUEUE_NAMES.JOB_QUEUE, this.processJob.bind(this), bullmq_config_1.defaultQueueOptions);
        this.worker.on('completed', this.onJobCompleted.bind(this));
        this.worker.on('failed', (job, error) => this.onJobFailed(job, error));
    }
    async start() {
        logger_1.logger.info('BullMQ worker started');
    }
    async processJob(bullJob) {
        const job = bullJob.data;
        logger_1.logger.info('Processing job', { jobId: job.id, jobName: job.name, enabled: job.enabled });
        // Double-check if job is still enabled before processing
        const currentJob = await job_service_1.jobService.getJobById(job.id);
        if (!currentJob) {
            logger_1.logger.warn('Job not found during processing, skipping', { jobId: job.id, jobName: job.name });
            return;
        }
        if (!currentJob.enabled) {
            logger_1.logger.warn('Job is disabled, skipping execution', {
                jobId: job.id,
                jobName: job.name,
                enabled: currentJob.enabled
            });
            return;
        }
        await job_service_1.jobService.updateJob(job.id, {
            status: job_1.JobStatus.RUNNING,
            lastRunAt: new Date()
        });
        await cache_service_1.cacheService.invalidateJobListCaches();
        await this.executeJob(currentJob);
        await job_service_1.jobService.updateJob(job.id, {
            status: job_1.JobStatus.COMPLETED,
            lastRunAt: new Date()
        });
        await cache_service_1.cacheService.invalidateJobListCaches();
    }
    async onJobCompleted(bullJob) {
        const job = bullJob.data;
        logger_1.logger.info('Job completed', { jobId: job.id, jobName: job.name });
        await cache_service_1.cacheService.invalidateJobListCaches();
    }
    async onJobFailed(bullJob, error) {
        if (!bullJob) {
            logger_1.logger.error('Job failed but no job data available', { error: error.message });
            return;
        }
        const job = bullJob.data;
        logger_1.logger.error('Job failed', {
            jobId: job.id,
            jobName: job.name,
            error: error.message
        });
        await job_service_1.jobService.updateJob(job.id, {
            status: job_1.JobStatus.FAILED
        });
        await cache_service_1.cacheService.invalidateJobListCaches();
    }
    async executeJob(job) {
        logger_1.logger.info('Executing job', { jobId: job.id, jobName: job.name });
        await new Promise(resolve => setTimeout(resolve, 1000));
        logger_1.logger.info('Job execution completed', { jobId: job.id, jobName: job.name });
    }
    async close() {
        await this.worker.close();
        logger_1.logger.info('BullMQ worker closed');
    }
}
exports.jobWorker = new JobWorker();
