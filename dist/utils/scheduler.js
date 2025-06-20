"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduler = exports.Scheduler = void 0;
exports.calculateNextRun = calculateNextRun;
const logger_1 = require("./logger");
const job_1 = require("../types/job");
function calculateNextRun(job) {
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
    const normalizedFrequency = job.frequency.toString().toUpperCase();
    // For one-time jobs, return start date
    if (normalizedFrequency === job_1.JobFrequency.ONCE) {
        return startDate;
    }
    // For recurring jobs, calculate next run based on frequency
    const lastRun = job.lastRunAt ? new Date(job.lastRunAt) : startDate;
    const nextRun = new Date(lastRun);
    switch (normalizedFrequency) {
        case job_1.JobFrequency.DAILY:
            nextRun.setDate(nextRun.getDate() + 1);
            break;
        case job_1.JobFrequency.WEEKLY:
            nextRun.setDate(nextRun.getDate() + 7);
            break;
        case job_1.JobFrequency.MONTHLY:
            nextRun.setMonth(nextRun.getMonth() + 1);
            break;
        case job_1.JobFrequency.CUSTOM:
            if (!job.cronExpression) {
                throw new Error('Cron expression is required for custom frequency jobs');
            }
            // For custom frequency, we'll let BullMQ handle the scheduling
            return startDate;
        default:
            logger_1.logger.warn(`Unknown job frequency: ${job.frequency}, treating as ONCE`);
            // Fallback to ONCE for unknown frequencies
            return startDate;
    }
    return nextRun;
}
class Scheduler {
    constructor() { }
    static getInstance() {
        if (!Scheduler.instance) {
            Scheduler.instance = new Scheduler();
        }
        return Scheduler.instance;
    }
    async start() {
        try {
            // Initialize any necessary startup tasks
            logger_1.logger.info('Scheduler started successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to start scheduler:', error);
            throw error;
        }
    }
    async stop() {
        try {
            // Cleanup any necessary resources
            logger_1.logger.info('Scheduler stopped successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to stop scheduler:', error);
            throw error;
        }
    }
}
exports.Scheduler = Scheduler;
exports.scheduler = Scheduler.getInstance();
