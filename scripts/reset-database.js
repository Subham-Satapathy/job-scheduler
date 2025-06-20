const { drizzle } = require('drizzle-orm/postgres-js');
const { Queue } = require('bullmq');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');

// Import environment configuration
require('dotenv').config();

// Create database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
};

console.log('🚀 Starting database and Redis reset...');

async function resetDatabase() {
  try {
    console.log('📋 Step 1: Clearing Redis job queues...');
    
    // Clear BullMQ job queues
    const jobQueue = new Queue('job-queue', {
      connection: redisConfig,
      prefix: process.env.BULLMQ_PREFIX || 'bullmq',
    });

    // Clear all jobs from the queue
    await jobQueue.obliterate({ force: true });
    console.log('✅ Redis job queues cleared');

    // Close the queue connection
    await jobQueue.close();

    console.log('📋 Step 2: Dropping existing jobs table...');
    
    // Drop the existing jobs table
    await db.execute(sql`DROP TABLE IF EXISTS "jobs" CASCADE`);
    console.log('✅ Jobs table dropped');

    console.log('📋 Step 3: Dropping existing enum types...');
    
    // Drop existing enum types
    await db.execute(sql`DROP TYPE IF EXISTS "job_status" CASCADE`);
    await db.execute(sql`DROP TYPE IF EXISTS "job_frequency" CASCADE`);
    console.log('✅ Enum types dropped');

    console.log('📋 Step 4: Creating new enum types...');
    
    // Create new enum types
    await db.execute(sql`CREATE TYPE "job_status" AS ENUM('pending', 'running', 'completed', 'failed')`);
    await db.execute(sql`CREATE TYPE "job_frequency" AS ENUM('once', 'daily', 'weekly', 'monthly', 'custom')`);
    console.log('✅ Enum types created');

    console.log('📋 Step 5: Creating new jobs table with enabled field...');
    
    // Create new jobs table with enabled field
    await db.execute(sql`
      CREATE TABLE "jobs" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "status" "job_status" DEFAULT 'pending' NOT NULL,
        "enabled" boolean DEFAULT true NOT NULL,
        "frequency" "job_frequency" NOT NULL,
        "cron_expression" varchar(100),
        "start_date" timestamp NOT NULL,
        "end_date" timestamp,
        "last_run_at" timestamp,
        "next_run_at" timestamp,
        "data" jsonb DEFAULT '{}'::jsonb,
        "retry_count" integer DEFAULT 0 NOT NULL,
        "max_retries" integer DEFAULT 3 NOT NULL,
        "data_hash" varchar(64) NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ Jobs table created with enabled field');

    console.log('📋 Step 6: Creating optimized indexes...');
    
    // Create essential indexes based on actual query patterns
    const indexes = [
      // Essential single-column indexes
      `CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status")`,
      `CREATE INDEX "jobs_next_run_at_idx" ON "jobs" USING btree ("next_run_at")`,
      `CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at")`,
      `CREATE INDEX "jobs_data_hash_idx" ON "jobs" USING btree ("data_hash")`,
      
      // New enabled-related indexes
      `CREATE INDEX "jobs_enabled_idx" ON "jobs" USING btree ("enabled")`,
      `CREATE INDEX "jobs_enabled_status_idx" ON "jobs" USING btree ("enabled", "status")`,
      `CREATE INDEX "jobs_enabled_next_run_idx" ON "jobs" USING btree ("enabled", "next_run_at")`,
      
      // Unique index for duplicate detection
      `CREATE UNIQUE INDEX "jobs_duplicate_check_idx" ON "jobs" USING btree ("name", "frequency", "cron_expression", "data_hash")`
    ];

    for (const indexSql of indexes) {
      await db.execute(sql.raw(indexSql));
    }
    console.log('✅ Optimized indexes created');

    console.log('📋 Step 7: Updating Drizzle metadata...');
    
    // Clear Drizzle migrations table to reset state
    await db.execute(sql`DELETE FROM "drizzle"."__drizzle_migrations"`);
    console.log('✅ Drizzle metadata cleared');

    console.log('🎉 Database reset completed successfully!');
    console.log('📊 Summary:');
    console.log('   - Redis job queues cleared');
    console.log('   - Jobs table recreated with "enabled" field');
    console.log('   - 8 optimized indexes created');
    console.log('   - Unused indexes removed');
    console.log('   - Drizzle metadata reset');
    
  } catch (error) {
    console.error('❌ Error during database reset:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the reset
resetDatabase(); 