"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllJobsQuerySchema = exports.getJobParamsSchema = exports.updateJobSchema = exports.createJobSchema = void 0;
const zod_1 = require("zod");
const job_1 = require("../types/job");
// Base schema for user-provided job fields (for create/update operations)
const jobInputSchema = {
    name: zod_1.z.string()
        .min(1, 'Job name is required')
        .max(255, 'Job name must be less than 255 characters'),
    description: zod_1.z.string()
        .max(1000, 'Description must be less than 1000 characters')
        .nullable()
        .optional(),
    enabled: zod_1.z.boolean()
        .default(true),
    frequency: zod_1.z.nativeEnum(job_1.JobFrequency, {
        errorMap: () => ({ message: 'Invalid job frequency' })
    }),
    cronExpression: zod_1.z.string()
        .regex(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, 'Invalid cron expression format')
        .nullable()
        .optional(),
    startDate: zod_1.z.string()
        .datetime('Invalid start date format')
        .transform((str) => new Date(str)),
    endDate: zod_1.z.string()
        .datetime('Invalid end date format')
        .transform((str) => new Date(str))
        .nullable()
        .optional(),
    data: zod_1.z.record(zod_1.z.any())
        .default({}),
    maxRetries: zod_1.z.number()
        .int('Max retries must be an integer')
        .min(0, 'Max retries must be non-negative')
        .max(10, 'Max retries cannot exceed 10')
        .default(3)
};
// Create job validation schema - transforms to service-compatible format
exports.createJobSchema = zod_1.z.object(jobInputSchema)
    .refine((data) => {
    // If frequency is CUSTOM, cronExpression is required
    if (data.frequency === job_1.JobFrequency.CUSTOM && !data.cronExpression) {
        return false;
    }
    return true;
}, {
    message: 'Cron expression is required when frequency is CUSTOM',
    path: ['cronExpression']
})
    .refine((data) => {
    // If frequency is not CUSTOM, cronExpression should be null
    if (data.frequency !== job_1.JobFrequency.CUSTOM && data.cronExpression) {
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
    status: job_1.JobStatus.PENDING,
    retryCount: 0,
    lastRunAt: null,
    nextRunAt: null,
}));
// Update job validation schema (all fields optional except constraints)
exports.updateJobSchema = zod_1.z.object({
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
    if (data.frequency === job_1.JobFrequency.CUSTOM && !data.cronExpression) {
        return false;
    }
    return true;
}, {
    message: 'Cron expression is required when frequency is CUSTOM',
    path: ['cronExpression']
}).refine((data) => {
    // If frequency is not CUSTOM, cronExpression should be null
    if (data.frequency && data.frequency !== job_1.JobFrequency.CUSTOM && data.cronExpression) {
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
exports.getJobParamsSchema = zod_1.z.object({
    id: zod_1.z.string()
        .regex(/^\d+$/, 'Job ID must be a positive integer')
        .transform((str) => parseInt(str, 10))
});
exports.getAllJobsQuerySchema = zod_1.z.object({
    page: zod_1.z.string()
        .regex(/^\d+$/, 'Page must be a positive integer')
        .transform((str) => parseInt(str, 10))
        .default('1'),
    limit: zod_1.z.string()
        .regex(/^\d+$/, 'Limit must be a positive integer')
        .transform((str) => Math.min(parseInt(str, 10), 100)) // Cap at 100
        .default('10'),
    status: zod_1.z.nativeEnum(job_1.JobStatus, {
        errorMap: () => ({ message: 'Invalid job status' })
    }).optional()
});
