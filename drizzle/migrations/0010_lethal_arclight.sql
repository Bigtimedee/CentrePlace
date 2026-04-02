CREATE TABLE "research_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"answer" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"iterations" integer DEFAULT 0,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "research_traces" ADD CONSTRAINT "research_traces_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_traces_user_id_idx" ON "research_traces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "research_traces_status_idx" ON "research_traces" USING btree ("status");--> statement-breakpoint
CREATE INDEX "research_traces_created_at_idx" ON "research_traces" USING btree ("created_at");