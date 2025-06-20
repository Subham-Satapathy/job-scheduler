"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobs = exports.jobFrequencyEnum = exports.jobStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.jobStatusEnum = (0, pg_core_1.pgEnum)('job_status', ['pending', 'running', 'completed', 'failed']);
exports.jobFrequencyEnum = (0, pg_core_1.pgEnum)('job_frequency', ['once', 'daily', 'weekly', 'monthly', 'custom']);
exports.jobs = (0, pg_core_1.pgTable)('jobs', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    status: (0, exports.jobStatusEnum)('status').notNull().default('pending'),
    enabled: (0, pg_core_1.boolean)('enabled').notNull().default(true),
    frequency: (0, exports.jobFrequencyEnum)('frequency').notNull(),
    cronExpression: (0, pg_core_1.varchar)('cron_expression', { length: 100 }),
    startDate: (0, pg_core_1.timestamp)('start_date').notNull(),
    endDate: (0, pg_core_1.timestamp)('end_date'),
    lastRunAt: (0, pg_core_1.timestamp)('last_run_at'),
    nextRunAt: (0, pg_core_1.timestamp)('next_run_at'),
    data: (0, pg_core_1.jsonb)('data').default({}),
    retryCount: (0, pg_core_1.integer)('retry_count').notNull().default(0),
    maxRetries: (0, pg_core_1.integer)('max_retries').notNull().default(3),
    dataHash: (0, pg_core_1.varchar)('data_hash', { length: 64 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
}, (table) => ({
    // Essential indexes based on actual query patterns
    statusIdx: (0, pg_core_1.index)('jobs_status_idx').on(table.status),
    nextRunAtIdx: (0, pg_core_1.index)('jobs_next_run_at_idx').on(table.nextRunAt),
    createdAtIdx: (0, pg_core_1.index)('jobs_created_at_idx').on(table.createdAt),
    duplicateCheckIdx: (0, pg_core_1.uniqueIndex)('jobs_duplicate_check_idx').on(table.name, table.frequency, table.cronExpression, table.dataHash),
    dataHashIdx: (0, pg_core_1.index)('jobs_data_hash_idx').on(table.dataHash),
    enabledIdx: (0, pg_core_1.index)('jobs_enabled_idx').on(table.enabled),
    enabledStatusIdx: (0, pg_core_1.index)('jobs_enabled_status_idx').on(table.enabled, table.status),
    enabledNextRunIdx: (0, pg_core_1.index)('jobs_enabled_next_run_idx').on(table.enabled, table.nextRunAt),
}));
