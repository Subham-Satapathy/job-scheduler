import { pgTable, serial, varchar, text, timestamp, integer, jsonb, pgEnum, index, uniqueIndex, boolean } from 'drizzle-orm/pg-core';

export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed']);
export const jobFrequencyEnum = pgEnum('job_frequency', ['once', 'daily', 'weekly', 'monthly', 'custom']);

export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: jobStatusEnum('status').notNull().default('pending'),
  enabled: boolean('enabled').notNull().default(true),
  frequency: jobFrequencyEnum('frequency').notNull(),
  cronExpression: varchar('cron_expression', { length: 100 }),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  data: jsonb('data').default({}),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  dataHash: varchar('data_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Essential indexes based on actual query patterns
  statusIdx: index('jobs_status_idx').on(table.status),
  nextRunAtIdx: index('jobs_next_run_at_idx').on(table.nextRunAt),
  createdAtIdx: index('jobs_created_at_idx').on(table.createdAt),
  duplicateCheckIdx: uniqueIndex('jobs_duplicate_check_idx').on(table.name, table.frequency, table.cronExpression, table.dataHash),
  dataHashIdx: index('jobs_data_hash_idx').on(table.dataHash),
  enabledIdx: index('jobs_enabled_idx').on(table.enabled),
  enabledStatusIdx: index('jobs_enabled_status_idx').on(table.enabled, table.status),
  enabledNextRunIdx: index('jobs_enabled_next_run_idx').on(table.enabled, table.nextRunAt),
})); 