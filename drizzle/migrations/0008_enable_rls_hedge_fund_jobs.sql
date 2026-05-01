-- Enable Row Level Security on hedge_fund_jobs.
-- Table was created outside the Drizzle migration system and missed the
-- RLS sweep in 0003_enable_rls. The app uses service_role which bypasses
-- RLS; enabling it blocks direct PostgREST access for anon/authenticated.

--> statement-breakpoint
ALTER TABLE "hedge_fund_jobs" ENABLE ROW LEVEL SECURITY;
