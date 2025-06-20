import { z } from 'zod';
import { JobStatus, JobFrequency } from '../types/job';

// Base schema for user-provided job fields (for create/update operations)
const jobInputSchema = {
  name: z.string()
    .min(1, 'Job name is required')
    .max(255, 'Job name must be less than 255 characters'),
  
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .nullable()
    .optional(),
  
  enabled: z.boolean()
    .default(true),
  
  frequency: z.nativeEnum(JobFrequency, {
    errorMap: () => ({ message: 'Invalid job frequency' })
  }),
  
  cronExpression: z.string()
    .regex(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, 
      'Invalid cron expression format')
    .nullable()
    .optional(),
  
  startDate: z.string()
    .datetime('Invalid start date format')
    .transform((str) => new Date(str)),
  
  endDate: z.string()
    .datetime('Invalid end date format')
    .transform((str) => new Date(str))
    .nullable()
    .optional(),
  
  data: z.record(z.any())
    .default({}),
  
  maxRetries: z.number()
    .int('Max retries must be an integer')
    .min(0, 'Max retries must be non-negative')
    .max(10, 'Max retries cannot exceed 10')
    .default(3)
};

// Create job validation schema - transforms to service-compatible format
export const createJobSchema = z.object(jobInputSchema)
  .refine((data) => {
    // If frequency is CUSTOM, cronExpression is required
    if (data.frequency === JobFrequency.CUSTOM && !data.cronExpression) {
      return false;
    }
    return true;
  }, {
    message: 'Cron expression is required when frequency is CUSTOM',
    path: ['cronExpression']
  })
  .refine((data) => {
    // If frequency is not CUSTOM, cronExpression should be null
    if (data.frequency !== JobFrequency.CUSTOM && data.cronExpression) {
      return false;
    }
    return true;
  }, {
    message: 'Cron expression should only be provided when frequency is CUSTOM',
    path: ['cronExpression']
  })
  .refine((data) => {
    // End date should be after start date
    if (data.endDate && data.endDate <= data.startDate) {
      return false;
    }
    return true;
  }, {
    message: 'End date must be after start date',
    path: ['endDate']
  })
  .transform((data) => ({
    ...data,
    // Add required fields that the service expects
    status: JobStatus.PENDING,
    retryCount: 0,
    lastRunAt: null,
    nextRunAt: null,
  }));

// Update job validation schema (all fields optional except constraints)
export const updateJobSchema = z.object({
  name: jobInputSchema.name.optional(),
  description: jobInputSchema.description,
  enabled: jobInputSchema.enabled.optional(),
  frequency: jobInputSchema.frequency.optional(),
  cronExpression: jobInputSchema.cronExpression,
  startDate: jobInputSchema.startDate.optional(),
  endDate: jobInputSchema.endDate,
  data: jobInputSchema.data.optional(),
  maxRetries: jobInputSchema.maxRetries.optional()
}).refine((data) => {
  // If frequency is CUSTOM, cronExpression is required
  if (data.frequency === JobFrequency.CUSTOM && !data.cronExpression) {
    return false;
  }
  return true;
}, {
  message: 'Cron expression is required when frequency is CUSTOM',
  path: ['cronExpression']
}).refine((data) => {
  // If frequency is not CUSTOM, cronExpression should be null
  if (data.frequency && data.frequency !== JobFrequency.CUSTOM && data.cronExpression) {
    return false;
  }
  return true;
}, {
  message: 'Cron expression should only be provided when frequency is CUSTOM',
  path: ['cronExpression']
}).refine((data) => {
  // End date should be after start date if both are provided
  if (data.endDate && data.startDate && data.endDate <= data.startDate) {
    return false;
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate']
});

// Query parameter validation schemas
export const getJobParamsSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'Job ID must be a positive integer')
    .transform((str) => parseInt(str, 10))
});

export const getAllJobsQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform((str) => parseInt(str, 10))
    .default('1'),
  
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform((str) => Math.min(parseInt(str, 10), 100)) // Cap at 100
    .default('10'),
  
  status: z.nativeEnum(JobStatus, {
    errorMap: () => ({ message: 'Invalid job status' })
  }).optional()
});

// Type exports for TypeScript
export type CreateJobRequest = z.infer<typeof createJobSchema>;
export type UpdateJobRequest = z.infer<typeof updateJobSchema>;
export type GetJobParams = z.infer<typeof getJobParamsSchema>;
export type GetAllJobsQuery = z.infer<typeof getAllJobsQuerySchema>; 