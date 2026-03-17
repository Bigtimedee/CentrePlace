CREATE TYPE "public"."education_type" AS ENUM('none', 'public', 'private');--> statement-breakpoint
CREATE TYPE "public"."filing_status" AS ENUM('single', 'married_filing_jointly');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('taxable', 'traditional_ira', 'roth_ira', 'traditional_401k', 'roth_401k', 'sep_ira', 'solo_401k');--> statement-breakpoint
CREATE TYPE "public"."loan_type" AS ENUM('fixed', 'arm');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('primary_residence', 'rental', 'vacation', 'commercial', 'llc_held');--> statement-breakpoint
CREATE TYPE "public"."ownership_structure" AS ENUM('personal', 'ilit');--> statement-breakpoint
CREATE TYPE "public"."policy_type" AS ENUM('term', 'whole_life', 'ppli');--> statement-breakpoint
CREATE TABLE "children" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"birth_year" integer NOT NULL,
	"k12_tuition_cost" real DEFAULT 0 NOT NULL,
	"education_type" "education_type" DEFAULT 'none' NOT NULL,
	"annual_education_cost" real DEFAULT 0,
	"includes_graduate_school" boolean DEFAULT false NOT NULL,
	"graduate_school_cost" real DEFAULT 0,
	"graduate_school_years" integer DEFAULT 0,
	"inheritance_pct" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text,
	"filing_status" "filing_status" DEFAULT 'single' NOT NULL,
	"state_of_residence" text DEFAULT 'CA' NOT NULL,
	"birth_year" integer DEFAULT 1980 NOT NULL,
	"target_age" integer DEFAULT 90 NOT NULL,
	"assumed_return_rate" real DEFAULT 0.07 NOT NULL,
	"post_fi_return_rate" real DEFAULT 0.05 NOT NULL,
	"safe_harbor_election" boolean DEFAULT true NOT NULL,
	"city_of_residence" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"annual_salary" real DEFAULT 0 NOT NULL,
	"annual_bonus" real DEFAULT 0 NOT NULL,
	"salary_growth_rate" real DEFAULT 0.03 NOT NULL,
	"bonus_growth_rate" real DEFAULT 0.03 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "income_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "expenditures" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"description" text NOT NULL,
	"annual_amount" real NOT NULL,
	"growth_rate" real DEFAULT 0.03 NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"is_plaid_synced" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "one_time_expenditures" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"description" text NOT NULL,
	"amount" real NOT NULL,
	"projected_year" integer NOT NULL,
	"projected_quarter" text DEFAULT 'Q2' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"is_child_education" boolean DEFAULT false NOT NULL,
	"child_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plaid_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"item_id" text NOT NULL,
	"institution_name" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_name" text NOT NULL,
	"account_type" "account_type" NOT NULL,
	"current_balance" real DEFAULT 0 NOT NULL,
	"equity_pct" real DEFAULT 0.7 NOT NULL,
	"bond_pct" real DEFAULT 0.2 NOT NULL,
	"alt_pct" real DEFAULT 0.1 NOT NULL,
	"equity_return_rate" real DEFAULT 0.08 NOT NULL,
	"bond_return_rate" real DEFAULT 0.04 NOT NULL,
	"alt_return_rate" real DEFAULT 0.07 NOT NULL,
	"annual_contribution" real DEFAULT 0 NOT NULL,
	"ordinary_yield_rate" real DEFAULT 0 NOT NULL,
	"qualified_yield_rate" real DEFAULT 0 NOT NULL,
	"tax_exempt_yield_rate" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carry_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"fund_name" text NOT NULL,
	"vintage_year" integer NOT NULL,
	"carry_pct" real NOT NULL,
	"total_committed_capital" real NOT NULL,
	"current_tvpi" real DEFAULT 1 NOT NULL,
	"expected_gross_carry" real DEFAULT 0 NOT NULL,
	"haircut_pct" real DEFAULT 0.2 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carry_realizations" (
	"id" text PRIMARY KEY NOT NULL,
	"carry_position_id" text NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"quarter" text DEFAULT 'Q4' NOT NULL,
	"pct" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lp_investments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"fund_name" text NOT NULL,
	"vintage_year" integer NOT NULL,
	"commitment_amount" real NOT NULL,
	"current_nav" real DEFAULT 0 NOT NULL,
	"expected_distributions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgages" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"outstanding_balance" real NOT NULL,
	"interest_rate" real NOT NULL,
	"remaining_term_months" integer NOT NULL,
	"loan_type" "loan_type" DEFAULT 'fixed' NOT NULL,
	"arm_adjustment_schedule" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "real_estate_properties" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"property_name" text NOT NULL,
	"property_type" "property_type" NOT NULL,
	"current_value" real NOT NULL,
	"purchase_price" real NOT NULL,
	"purchase_year" integer NOT NULL,
	"appreciation_rate" real DEFAULT 0.04 NOT NULL,
	"ownership_pct" real DEFAULT 1 NOT NULL,
	"llc_valuation_discount_pct" real DEFAULT 0,
	"annual_rental_income" real DEFAULT 0,
	"annual_operating_expenses" real DEFAULT 0,
	"personal_use_days_per_year" integer DEFAULT 0,
	"projected_sale_year" integer,
	"projected_sale_quarter" text DEFAULT 'Q3',
	"is_1031_exchange" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"policy_name" text NOT NULL,
	"policy_type" "policy_type" NOT NULL,
	"ownership_structure" "ownership_structure" DEFAULT 'personal' NOT NULL,
	"insurer" text,
	"death_benefit" real NOT NULL,
	"annual_premium" real DEFAULT 0 NOT NULL,
	"premium_years_remaining" integer DEFAULT 0 NOT NULL,
	"current_cash_value" real DEFAULT 0,
	"assumed_return_rate" real DEFAULT 0.05,
	"outstanding_loan_balance" real DEFAULT 0,
	"max_loan_pct" real DEFAULT 0.9,
	"ppli_underlying_allocation" text,
	"is_estate_tax_funding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realization_policy" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"equity_pct" real DEFAULT 0.5 NOT NULL,
	"equity_appreciation_rate" real DEFAULT 0.055 NOT NULL,
	"equity_qualified_yield_rate" real DEFAULT 0.015 NOT NULL,
	"taxable_fixed_income_pct" real DEFAULT 0.2 NOT NULL,
	"taxable_fixed_income_rate" real DEFAULT 0.04 NOT NULL,
	"tax_exempt_fixed_income_pct" real DEFAULT 0.1 NOT NULL,
	"tax_exempt_fixed_income_rate" real DEFAULT 0.03 NOT NULL,
	"real_estate_pct" real DEFAULT 0.2 NOT NULL,
	"re_appreciation_rate" real DEFAULT 0.04 NOT NULL,
	"re_gross_yield_rate" real DEFAULT 0.06 NOT NULL,
	"re_carrying_cost_rate" real DEFAULT 0.02 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "realization_policy_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_profiles" ADD CONSTRAINT "income_profiles_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenditures" ADD CONSTRAINT "expenditures_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_time_expenditures" ADD CONSTRAINT "one_time_expenditures_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_time_expenditures" ADD CONSTRAINT "one_time_expenditures_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_connections" ADD CONSTRAINT "plaid_connections_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_accounts" ADD CONSTRAINT "investment_accounts_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carry_positions" ADD CONSTRAINT "carry_positions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carry_realizations" ADD CONSTRAINT "carry_realizations_carry_position_id_carry_positions_id_fk" FOREIGN KEY ("carry_position_id") REFERENCES "public"."carry_positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carry_realizations" ADD CONSTRAINT "carry_realizations_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lp_investments" ADD CONSTRAINT "lp_investments_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgages" ADD CONSTRAINT "mortgages_property_id_real_estate_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."real_estate_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_properties" ADD CONSTRAINT "real_estate_properties_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realization_policy" ADD CONSTRAINT "realization_policy_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "children_user_id_idx" ON "children" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expenditures_user_id_idx" ON "expenditures" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "one_time_expenditures_user_id_idx" ON "one_time_expenditures" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plaid_connections_user_id_idx" ON "plaid_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_accounts_user_id_idx" ON "investment_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "carry_positions_user_id_idx" ON "carry_positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "carry_realizations_user_id_idx" ON "carry_realizations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "carry_realizations_position_id_idx" ON "carry_realizations" USING btree ("carry_position_id");--> statement-breakpoint
CREATE INDEX "lp_investments_user_id_idx" ON "lp_investments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "real_estate_properties_user_id_idx" ON "real_estate_properties" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "insurance_policies_user_id_idx" ON "insurance_policies" USING btree ("user_id");