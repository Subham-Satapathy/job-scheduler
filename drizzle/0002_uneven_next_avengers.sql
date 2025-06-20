-- Add data_hash column as nullable first to allow existing data
ALTER TABLE "jobs" ADD COLUMN "data_hash" varchar(64);--> statement-breakpoint

-- Update existing jobs with computed hash values
-- This will be done by the application migration script
-- UPDATE "jobs" SET "data_hash" = compute_hash(name, frequency, cron_expression, data) WHERE "data_hash" IS NULL;

-- Make the column NOT NULL after updating existing data
-- ALTER TABLE "jobs" ALTER COLUMN "data_hash" SET NOT NULL;

-- Create indexes for duplicate detection
CREATE INDEX "idx_jobs_duplicate_detection" ON "jobs" USING btree ("name","frequency","cron_expression","data_hash");--> statement-breakpoint
CREATE INDEX "idx_jobs_data_hash" ON "jobs" USING btree ("data_hash");