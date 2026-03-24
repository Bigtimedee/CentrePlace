CREATE TABLE "account_holdings" (
	"id" text PRIMARY KEY NOT NULL,
	"statement_id" text NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"ticker" text,
	"security_name" text NOT NULL,
	"asset_class" text DEFAULT 'equity' NOT NULL,
	"shares" real,
	"price_per_share" real,
	"market_value" real NOT NULL,
	"percent_of_account" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_statements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"parsed_at" timestamp,
	"statement_date" text,
	"brokerage_name" text,
	"raw_parse_output" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_investments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"security_name" text NOT NULL,
	"asset_class" text DEFAULT 'equity' NOT NULL,
	"industry" text,
	"stage" text,
	"ownership_pct" real,
	"current_value" real NOT NULL,
	"cost_basis" real,
	"purchase_date" text,
	"expected_exit_year" integer,
	"expected_return_rate" real DEFAULT 0.07 NOT NULL,
	"ordinary_yield_rate" real DEFAULT 0 NOT NULL,
	"qualified_yield_rate" real DEFAULT 0 NOT NULL,
	"tax_exempt_yield_rate" real DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_holdings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"coin_name" text NOT NULL,
	"symbol" text,
	"quantity_coins" real DEFAULT 0 NOT NULL,
	"price_per_coin" real,
	"current_value" real NOT NULL,
	"cost_basis" real,
	"expected_appreciation_rate" real DEFAULT 0.07 NOT NULL,
	"expected_sale_year" integer,
	"sale_fraction" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equity_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"grant_type" text NOT NULL,
	"grant_date" text NOT NULL,
	"total_shares" integer NOT NULL,
	"strike_price" real,
	"current_fmv" real NOT NULL,
	"fmv_growth_rate" real DEFAULT 0.08 NOT NULL,
	"expiration_date" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equity_share_lots" (
	"id" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"shares" integer NOT NULL,
	"cost_basis_per_share" real NOT NULL,
	"acquired_date" text NOT NULL,
	"projected_sale_year" integer,
	"projected_sale_quarter" text,
	"is_iso_qualifying" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equity_vesting_events" (
	"id" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"quarter" text DEFAULT 'Q1' NOT NULL,
	"shares" integer NOT NULL,
	"projected_fmv_at_event" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "carry_positions" ADD COLUMN "current_account_balance" real;--> statement-breakpoint
ALTER TABLE "account_holdings" ADD CONSTRAINT "account_holdings_statement_id_account_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."account_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_holdings" ADD CONSTRAINT "account_holdings_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_holdings" ADD CONSTRAINT "account_holdings_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_statements" ADD CONSTRAINT "account_statements_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_statements" ADD CONSTRAINT "account_statements_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_investments" ADD CONSTRAINT "direct_investments_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_holdings" ADD CONSTRAINT "crypto_holdings_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equity_grants" ADD CONSTRAINT "equity_grants_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equity_share_lots" ADD CONSTRAINT "equity_share_lots_grant_id_equity_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."equity_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equity_share_lots" ADD CONSTRAINT "equity_share_lots_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equity_vesting_events" ADD CONSTRAINT "equity_vesting_events_grant_id_equity_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."equity_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equity_vesting_events" ADD CONSTRAINT "equity_vesting_events_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_holdings_statement_id_idx" ON "account_holdings" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "account_holdings_user_id_idx" ON "account_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_holdings_account_id_idx" ON "account_holdings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_statements_user_id_idx" ON "account_statements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_statements_account_id_idx" ON "account_statements" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "direct_investments_user_id_idx" ON "direct_investments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "crypto_holdings_user_id_idx" ON "crypto_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "equity_grants_user_id_idx" ON "equity_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "equity_share_lots_user_id_idx" ON "equity_share_lots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "equity_share_lots_grant_id_idx" ON "equity_share_lots" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "equity_vesting_events_user_id_idx" ON "equity_vesting_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "equity_vesting_events_grant_id_idx" ON "equity_vesting_events" USING btree ("grant_id");