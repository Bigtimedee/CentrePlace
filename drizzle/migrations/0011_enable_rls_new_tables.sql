-- Enable Row Level Security on tables created after the initial RLS migration.
-- The app accesses Supabase exclusively via Drizzle with the service_role key,
-- which bypasses RLS by design. Enabling RLS (with no permissive policies for
-- anon/authenticated roles) blocks direct PostgREST access while leaving all
-- server-side application queries unaffected.

--> statement-breakpoint
ALTER TABLE "holding_recommendations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agent_analysis_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "legislation_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "research_traces" ENABLE ROW LEVEL SECURITY;
