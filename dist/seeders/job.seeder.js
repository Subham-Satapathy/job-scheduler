"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedJobs = seedJobs;
const db_1 = __importDefault(require("../db"));
const schema_1 = require("../db/schema");
const job_1 = require("../types/job");
const drizzle_orm_1 = require("drizzle-orm");
const date_fns_1 = require("date-fns");
const jobHash_1 = require("../utils/jobHash");
/**
 * Converts JobStatus enum to database string representation for seeding
 * @param status - JobStatus enum value from application domain
 * @returns Database string value ('pending' | 'running' | 'completed' | 'failed')
 */
function convertStatusToDbString(status) {
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
/**
 * Converts JobFrequency enum to database string representation for seeding
 * @param frequency - JobFrequency enum value from application domain
 * @returns Database string value ('once' | 'daily' | 'weekly' | 'monthly' | 'custom')
 */
function convertFrequencyToDbString(frequency) {
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
const now = new Date();
const dummyJobs = Array.from({ length: 30 }).map((_, i) => {
    const freq = i % 3 === 0 ? job_1.JobFrequency.DAILY : i % 3 === 1 ? job_1.JobFrequency.WEEKLY : job_1.JobFrequency.MONTHLY;
    const cronMap = {
        [job_1.JobFrequency.DAILY]: '0 8 * * *', // Every day at 8am
        [job_1.JobFrequency.WEEKLY]: '0 9 * * MON', // Every Monday at 9am
        [job_1.JobFrequency.MONTHLY]: '0 10 1 * *', // First of month at 10am
    };
    const jobData = {
        name: `Dummy Job ${i + 1}`,
        description: `This is a dummy job to simulate ${freq} tasks`,
        status: convertStatusToDbString(job_1.JobStatus.PENDING),
        frequency: convertFrequencyToDbString(freq),
        cronExpression: cronMap[freq],
        startDate: now,
        endDate: (0, date_fns_1.addDays)(now, 90),
        lastRunAt: null,
        nextRunAt: (0, date_fns_1.addDays)(now, i % 5),
        data: {
            email: `user${i + 1}@example.com`,
            type: i % 2 === 0 ? 'notification' : 'reporting',
            payload: {
                userId: i + 1,
                priority: ['low', 'medium', 'high'][i % 3],
            },
        },
        retryCount: 0,
        maxRetries: 3,
        createdAt: now,
        updatedAt: now,
    };
    // Generate dataHash for the job
    const dataHash = (0, jobHash_1.generateJobHash)({
        name: jobData.name,
        frequency: freq, // Use the original enum for hash generation
        cronExpression: jobData.cronExpression,
        data: jobData.data
    });
    return {
        ...jobData,
        dataHash
    };
});
/**
 * Seeds the database with 30 dummy jobs for testing and development
 * Creates jobs with varied frequencies (daily, weekly, monthly) and realistic data
 * Skips seeding if dummy jobs already exist to prevent duplicates
 */
async function seedJobs() {
    console.log('Seeding jobs...');
    const existing = await db_1.default.select().from(schema_1.jobs).where((0, drizzle_orm_1.eq)(schema_1.jobs.name, 'Dummy Job 1'));
    if (existing.length > 0) {
        console.log('Dummy jobs already exist. Skipping seeding.');
        return;
    }
    await db_1.default.insert(schema_1.jobs).values(dummyJobs);
    console.log('Seeded 30 dummy jobs into the database.');
}
if (require.main === module) {
    seedJobs()
        .then(() => {
        console.log('Seeding completed');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Seeding failed:', error);
        process.exit(1);
    });
}
