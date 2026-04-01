CREATE TABLE "agent_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tickers" jsonb DEFAULT '[]' NOT NULL,
	"results" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_analysis_jobs" ADD CONSTRAINT "agent_analysis_jobs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_analysis_jobs_user_id_idx" ON "agent_analysis_jobs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_analysis_jobs_status_idx" ON "agent_analysis_jobs" USING btree ("status");
