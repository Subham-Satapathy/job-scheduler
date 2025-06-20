import { Request, Response } from 'express';
import { jobService } from '../services/job.service';
import { JobStatus, CreateJobInput, UpdateJobInput } from '../types/job';
import { logger } from '../utils/logger';
import {
  CreateJobRequest,
  UpdateJobRequest,
  GetJobParams,
  GetAllJobsQuery
} from '../validation/job.validation';

export class JobController {
  public async createJob(req: Request, res: Response) {
    try {
      const forceCreate = req.query.forceCreate === 'true';
      
      const job = await jobService.createJob(req.body, { forceCreate });
      
      logger.info('Job created', { jobId: job.id, forceCreate });
      
      res.status(201).json({
        success: true,
        message: 'Job created successfully',
        data: job,
      });
    } catch (error: any) {
      if (error.code === 'DUPLICATE_JOB') {
        logger.warn('Duplicate job creation attempt', {
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
      
      logger.error('Failed to create job:', {
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

  public async getJob(req: Request, res: Response) {
    try {
      // req.params.id is validated by middleware and converted to number
      const jobId = req.params.id as unknown as number;
      const job = await jobService.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      logger.debug('Job retrieved successfully', { jobId });
      res.json(job);
    } catch (error) {
      logger.error('Failed to get job:', error);
      res.status(500).json({
        error: 'Failed to get job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async getAllJobs(req: Request, res: Response) {
    try {
      // req.query is validated by middleware with proper defaults and type conversion
      const { page, limit, status } = req.query as unknown as GetAllJobsQuery;

      const { jobs, total } = await jobService.getAllJobs(page, limit, status);

      logger.debug('Jobs retrieved successfully', { 
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
    } catch (error) {
      logger.error('Failed to get jobs:', error);
      res.status(500).json({
        error: 'Failed to get jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async updateJob(req: Request, res: Response) {
    try {
      // req.params.id is validated by middleware and req.body is validated as UpdateJobRequest
      const jobId = req.params.id as unknown as number;
      const job = await jobService.updateJob(jobId, req.body);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      logger.info('Job updated successfully', { 
        jobId, 
        jobName: job.name 
      });
      
      res.json(job);
    } catch (error) {
      logger.error('Failed to update job:', error);
      res.status(400).json({
        error: 'Failed to update job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async deleteJob(req: Request, res: Response) {
    try {
      // req.params.id is validated by middleware
      const jobId = req.params.id as unknown as number;
      const success = await jobService.deleteJob(jobId);
      if (!success) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      logger.info('Job deleted successfully', { jobId });
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete job:', error);
      res.status(500).json({
        error: 'Failed to delete job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async enableJob(req: Request, res: Response) {
    try {
      // req.params.id is validated by middleware
      const jobId = req.params.id as unknown as number;
      const job = await jobService.enableJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      logger.info('Job enabled successfully', { 
        jobId, 
        jobName: job.name,
        enabled: job.enabled
      });
      
      res.json({
        success: true,
        message: 'Job enabled successfully',
        data: job
      });
    } catch (error) {
      logger.error('Failed to enable job:', error);
      res.status(500).json({
        error: 'Failed to enable job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async disableJob(req: Request, res: Response) {
    try {
      // req.params.id is validated by middleware
      const jobId = req.params.id as unknown as number;
      const job = await jobService.disableJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      logger.info('Job disabled successfully', { 
        jobId, 
        jobName: job.name,
        enabled: job.enabled
      });
      
      res.json({
        success: true,
        message: 'Job disabled successfully',
        data: job
      });
    } catch (error) {
      logger.error('Failed to disable job:', error);
      res.status(500).json({
        error: 'Failed to disable job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const jobController = new JobController(); 