CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"cron_expression" varchar(100),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"data" jsonb NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
