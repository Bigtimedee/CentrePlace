CREATE TABLE "agent_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tickers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"results" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legislation_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" text NOT NULL,
	"congress" integer NOT NULL,
	"bill_type" text NOT NULL,
	"bill_number" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"status" text NOT NULL,
	"sponsor_name" text,
	"introduced_date" text,
	"latest_action" text,
	"latest_action_date" text,
	"topic_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "legislation_cache_bill_id_unique" UNIQUE("bill_id")
);
--> statement-breakpoint
ALTER TABLE "agent_analysis_jobs" ADD CONSTRAINT "agent_analysis_jobs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_analysis_jobs_user_id_idx" ON "agent_analysis_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_analysis_jobs_status_idx" ON "agent_analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "legislation_cache_fetched_at_idx" ON "legislation_cache" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "legislation_cache_bill_id_idx" ON "legislation_cache" USING btree ("bill_id");