"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobController = exports.JobController = void 0;
const job_service_1 = require("../services/job.service");
const logger_1 = require("../utils/logger");
class JobController {
    async createJob(req, res) {
        try {
            const forceCreate = req.query.forceCreate === 'true';
            const job = await job_service_1.jobService.createJob(req.body, { forceCreate });
            logger_1.logger.info('Job created', { jobId: job.id, forceCreate });
            res.status(201).json({
                success: true,
                message: 'Job created successfully',
                data: job,
            });
        }
        catch (error) {
            if (error.code === 'DUPLICATE_JOB') {
                logger_1.logger.warn('Duplicate job creation attempt', {
                    requestedName: req.body.name,
                    existingJobId: error.existingJob?.id
                });
                return res.status(409).json({
                    success: false,
                    error: 'Duplicate job detected',
                    message: error.message,
                    existingJob: error.existingJob,
                    suggestion: 'Use forceCreate=true query parameter to override duplicate detection'
                });
            }
            logger_1.logger.error('Failed to create job:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                body: req.body,
                stack: error instanceof Error ? error.stack : undefined
            });
            res.status(500).json({
                success: false,
                error: 'Failed to create job',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async getJob(req, res) {
        try {
            // req.params.id is validated by middleware and converted to number
            const jobId = req.params.id;
            const job = await job_service_1.jobService.getJobById(jobId);
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            logger_1.logger.debug('Job retrieved successfully', { jobId });
            res.json(job);
        }
        catch (error) {
            logger_1.logger.error('Failed to get job:', error);
            res.status(500).json({
                error: 'Failed to get job',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getAllJobs(req, res) {
        try {
            // req.query is validated by middleware with proper defaults and type conversion
            const { page, limit, status } = req.query;
            const { jobs, total } = await job_service_1.jobService.getAllJobs(page, limit, status);
            logger_1.logger.debug('Jobs retrieved successfully', {
                page,
                limit,
                status,
                total,
                jobsCount: jobs.length
            });
            res.json({
                jobs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get jobs:', error);
            res.status(500).json({
                error: 'Failed to get jobs',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async updateJob(req, res) {
        try {
            // req.params.id is validated by middleware and req.body is validated as UpdateJobRequest
            const jobId = req.params.id;
            const job = await job_service_1.jobService.updateJob(jobId, req.body);
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            logger_1.logger.info('Job updated successfully', {
                jobId,
                jobName: job.name
            });
            res.json(job);
        }
        catch (error) {
            logger_1.logger.error('Failed to update job:', error);
            res.status(400).json({
                error: 'Failed to update job',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async deleteJob(req, res) {
        try {
            // req.params.id is validated by middleware
            const jobId = req.params.id;
            const success = await job_service_1.jobService.deleteJob(jobId);
            if (!success) {
                return res.status(404).json({ error: 'Job not found' });
            }
            logger_1.logger.info('Job deleted successfully', { jobId });
            res.status(204).send();
        }
        catch (error) {
            logger_1.logger.error('Failed to delete job:', error);
            res.status(500).json({
                error: 'Failed to delete job',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async enableJob(req, res) {
        try {
            // req.params.id is validated by middleware
            const jobId = req.params.id;
            const job = await job_service_1.jobService.enableJob(jobId);
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            logger_1.logger.info('Job enabled successfully', {
                jobId,
                jobName: job.name,
                enabled: job.enabled
            });
            res.json({
                success: true,
                message: 'Job enabled successfully',
                data: job
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to enable job:', error);
            res.status(500).json({
                error: 'Failed to enable job',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async disableJob(req, res) {
        try {
            // req.params.id is validated by middleware
            const jobId = req.params.id;
            const job = await job_service_1.jobService.disableJob(jobId);
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }
            logger_1.logger.info('Job disabled successfully', {
                jobId,
                jobName: job.name,
                enabled: job.enabled
            });
            res.json({
                success: true,
                message: 'Job disabled successfully',
                data: job
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to disable job:', error);
            res.status(500).json({
                error: 'Failed to disable job',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
exports.JobController = JobController;
exports.jobController = new JobController();
