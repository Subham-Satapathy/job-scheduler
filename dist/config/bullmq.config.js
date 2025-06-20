"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueueName = exports.QUEUE_NAMES = exports.defaultWorkerOptions = exports.defaultQueueOptions = void 0;
const env_config_1 = require("./env.config");
exports.defaultQueueOptions = {
    connection: {
        host: env_config_1.envConfig.REDIS_HOST,
        port: env_config_1.envConfig.REDIS_PORT,
        password: env_config_1.envConfig.REDIS_PASSWORD,
    },
    prefix: env_config_1.envConfig.BULLMQ_PREFIX,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: {
            age: 24 * 3600, // keep completed jobs for 24 hours
            count: 1000, // keep last 1000 completed jobs
        },
        removeOnFail: {
            age: 7 * 24 * 3600, // keep failed jobs for 7 days
            count: 5000, // keep last 5000 failed jobs
        },
    },
};
exports.defaultWorkerOptions = {
    connection: exports.defaultQueueOptions.connection,
    prefix: exports.defaultQueueOptions.prefix,
    concurrency: 10,
    limiter: {
        max: 1000,
        duration: 1000,
    },
};
exports.QUEUE_NAMES = {
    JOB_QUEUE: 'job-queue',
};
// Helper function to create queue name with prefix
const getQueueName = (name) => {
    // Use underscore instead of colon for prefix separation
    return `${env_config_1.envConfig.BULLMQ_PREFIX}_${name}`;
};
exports.getQueueName = getQueueName;
