CREATE TABLE "holding_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"holding_id" text NOT NULL,
	"ticker" text,
	"security_name" text NOT NULL,
	"action" text NOT NULL,
	"target_allocation_note" text NOT NULL,
	"alternative_ticker" text,
	"alternative_security_name" text,
	"short_rationale" text NOT NULL,
	"full_rationale" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"urgency" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_holdings" ADD COLUMN "current_price" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "account_holdings" ADD COLUMN "current_value" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "account_holdings" ADD COLUMN "price_refreshed_at" timestamp;--> statement-breakpoint
ALTER TABLE "holding_recommendations" ADD CONSTRAINT "holding_recommendations_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_recommendations" ADD CONSTRAINT "holding_recommendations_holding_id_account_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."account_holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holding_recommendations_user_id_idx" ON "holding_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "holding_recommendations_holding_id_idx" ON "holding_recommendations" USING btree ("holding_id");