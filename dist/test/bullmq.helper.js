"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullMQTestHelper = void 0;
const bullmq_1 = require("bullmq");
const bullmq_config_1 = require("../config/bullmq.config");
class BullMQTestHelper {
    constructor() {
        this.worker = null;
        this.queue = new bullmq_1.Queue(bullmq_config_1.QUEUE_NAMES.JOB_QUEUE, bullmq_config_1.defaultQueueOptions);
    }
    async setup() {
        // Obliterate any existing jobs
        await this.queue.obliterate({ force: true });
    }
    async teardown() {
        await this.queue.close();
        if (this.worker) {
            await this.worker.close();
        }
    }
    getQueue() {
        return this.queue;
    }
    async getJobCounts() {
        const counts = await this.queue.getJobCounts();
        return {
            waiting: counts.waiting || 0,
            active: counts.active || 0,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
            delayed: counts.delayed || 0,
            paused: counts.paused || 0
        };
    }
    async waitForJobCompletion(jobId, timeout = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const job = await this.queue.getJob(jobId);
            if (!job) {
                throw new Error(`Job ${jobId} not found`);
            }
            const state = await job.getState();
            if (state === 'completed' || state === 'failed') {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Job ${jobId} did not complete within ${timeout}ms`);
    }
}
exports.BullMQTestHelper = BullMQTestHelper;
