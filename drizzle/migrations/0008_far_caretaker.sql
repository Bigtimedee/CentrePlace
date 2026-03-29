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
CREATE TABLE "hedge_fund_jobs" (
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
ALTER TABLE "agent_analysis_jobs" ADD CONSTRAINT "agent_analysis_jobs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hedge_fund_jobs" ADD CONSTRAINT "hedge_fund_jobs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_analysis_jobs_user_id_idx" ON "agent_analysis_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_analysis_jobs_status_idx" ON "agent_analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hedge_fund_jobs_user_id_idx" ON "hedge_fund_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "hedge_fund_jobs_status_idx" ON "hedge_fund_jobs" USING btree ("status");