"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateDataHash = populateDataHash;
const index_1 = __importDefault(require("../index"));
const schema_1 = require("../schema");
const drizzle_orm_1 = require("drizzle-orm");
const jobHash_1 = require("../../utils/jobHash");
const logger_1 = require("../../utils/logger");
const drizzle_orm_2 = require("drizzle-orm");
const job_1 = require("../../types/job");
// Helper function to convert database enum string to TypeScript enum
function dbStringToFrequency(dbValue) {
    switch (dbValue) {
        case 'once':
            return job_1.JobFrequency.ONCE;
        case 'daily':
            return job_1.JobFrequency.DAILY;
        case 'weekly':
            return job_1.JobFrequency.WEEKLY;
        case 'monthly':
            return job_1.JobFrequency.MONTHLY;
        case 'custom':
            return job_1.JobFrequency.CUSTOM;
        default:
            return job_1.JobFrequency.ONCE;
    }
}
/**
 * Migration script to populate dataHash for existing jobs
 * This should be run once to add dataHash values to all existing jobs
 */
async function populateDataHash() {
    try {
        logger_1.logger.info('Starting dataHash population for existing jobs...');
        const jobsWithoutHash = await index_1.default
            .select()
            .from(schema_1.jobs)
            .where((0, drizzle_orm_1.isNull)(schema_1.jobs.dataHash));
        logger_1.logger.info(`Found ${jobsWithoutHash.length} jobs without dataHash`);
        if (jobsWithoutHash.length === 0) {
            logger_1.logger.info('All jobs already have dataHash values');
            return;
        }
        for (const job of jobsWithoutHash) {
            const dataHash = (0, jobHash_1.generateJobHash)({
                name: job.name,
                frequency: dbStringToFrequency(job.frequency),
                cronExpression: job.cronExpression,
                data: job.data || {}
            });
            await index_1.default
                .update(schema_1.jobs)
                .set({ dataHash })
                .where((0, drizzle_orm_2.eq)(schema_1.jobs.id, job.id));
            logger_1.logger.debug(`Updated job ${job.id} with dataHash: ${dataHash}`);
        }
        const remainingJobsWithoutHash = await index_1.default
            .select()
            .from(schema_1.jobs)
            .where((0, drizzle_orm_1.isNull)(schema_1.jobs.dataHash));
        if (remainingJobsWithoutHash.length === 0) {
            logger_1.logger.info('All jobs now have dataHash values. Ready to make column NOT NULL.');
        }
        else {
            logger_1.logger.error(`${remainingJobsWithoutHash.length} jobs still missing dataHash values`);
            process.exit(1);
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to populate dataHash:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    populateDataHash()
        .then(() => {
        logger_1.logger.info('Migration completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
