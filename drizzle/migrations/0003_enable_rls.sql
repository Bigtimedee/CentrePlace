-- Enable Row Level Security on all public tables.
-- The app accesses Supabase exclusively via Drizzle with the service_role key,
-- which bypasses RLS by design. Enabling RLS (with no permissive policies for
-- anon/authenticated roles) blocks direct PostgREST access while leaving all
-- server-side application queries unaffected.

--> statement-breakpoint
ALTER TABLE "children" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "income_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expenditures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "one_time_expenditures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plaid_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "investment_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "carry_positions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "carry_realizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lp_investments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mortgages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "real_estate_properties" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "insurance_policies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "realization_policy" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account_holdings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account_statements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "direct_investments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crypto_holdings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "equity_grants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "equity_share_lots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "equity_vesting_events" ENABLE ROW LEVEL SECURITY;
