CREATE TABLE "daily_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"local_date" date NOT NULL,
	"responses" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"mutation_id" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"decision_id" text NOT NULL,
	"kind" text NOT NULL,
	"selected_action" text NOT NULL,
	"payload" jsonb NOT NULL,
	"mutation_id" text NOT NULL,
	"consent_version" integer NOT NULL,
	"responded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"action" text NOT NULL,
	"input_data_mode" text NOT NULL,
	"execution_mode" text NOT NULL,
	"payload" jsonb NOT NULL,
	"consent_version" integer NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"stale_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"local_date" date NOT NULL,
	"payload" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"mutation_id" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"signal" text NOT NULL,
	"purpose" text NOT NULL,
	"source_label" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"consent_version" integer NOT NULL,
	"changed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"input_data_mode" text NOT NULL,
	"payload" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"mutation_id" text NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'Europe/Dublin' NOT NULL,
	"goal" text DEFAULT 'build_strength' NOT NULL,
	"training_block" text DEFAULT 'base' NOT NULL,
	"usage_mode" text DEFAULT 'guided' NOT NULL,
	"restriction_text" text DEFAULT '' NOT NULL,
	"restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"consent_version" integer DEFAULT 1 NOT NULL,
	"account_status" text DEFAULT 'active' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"mutation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "health_samples_external_id_idx";--> statement-breakpoint
DROP INDEX "workouts_external_id_idx";--> statement-breakpoint
ALTER TABLE "daily_check_ins" ADD CONSTRAINT "daily_check_ins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_events" ADD CONSTRAINT "decision_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_events" ADD CONSTRAINT "decision_events_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_logs" ADD CONSTRAINT "manual_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_consents" ADD CONSTRAINT "signal_consents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_check_ins_user_date_idx" ON "daily_check_ins" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_check_ins_user_mutation_idx" ON "daily_check_ins" USING btree ("user_id","mutation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_events_user_mutation_idx" ON "decision_events" USING btree ("user_id","mutation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_events_decision_idx" ON "decision_events" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "decision_events_user_responded_idx" ON "decision_events" USING btree ("user_id","responded_at");--> statement-breakpoint
CREATE INDEX "decisions_user_generated_idx" ON "decisions" USING btree ("user_id","generated_at");--> statement-breakpoint
CREATE INDEX "decisions_user_status_idx" ON "decisions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_logs_user_date_idx" ON "manual_logs" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_logs_user_mutation_idx" ON "manual_logs" USING btree ("user_id","mutation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signal_consents_user_signal_idx" ON "signal_consents" USING btree ("user_id","signal");--> statement-breakpoint
CREATE INDEX "signal_consents_user_version_idx" ON "signal_consents" USING btree ("user_id","consent_version");--> statement-breakpoint
CREATE UNIQUE INDEX "training_sessions_user_mutation_idx" ON "training_sessions" USING btree ("user_id","mutation_id");--> statement-breakpoint
CREATE INDEX "training_sessions_user_updated_idx" ON "training_sessions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "health_samples_user_external_id_idx" ON "health_samples" USING btree ("user_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_user_external_id_idx" ON "workouts" USING btree ("user_id","external_id");