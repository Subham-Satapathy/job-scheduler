CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_jobs_next_run_at" ON "jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_created_at" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_last_run_at" ON "jobs" USING btree ("last_run_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_status_next_run" ON "jobs" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_status_created" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_frequency_status" ON "jobs" USING btree ("frequency","status");--> statement-breakpoint
CREATE INDEX "idx_jobs_retry_status" ON "jobs" USING btree ("retry_count","status");