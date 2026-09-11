CREATE TABLE "agent_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"agent_key" text NOT NULL,
	"insight_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"summary" text NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workout_type" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"duration_seconds" double precision NOT NULL,
	"distance_meters" double precision,
	"active_energy_kcal" double precision,
	"avg_heart_rate" double precision,
	"max_heart_rate" double precision,
	"perceived_exertion" double precision,
	"source_name" text,
	"external_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_insights" ADD CONSTRAINT "agent_insights_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_insights_user_created_idx" ON "agent_insights" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_insights_user_agent_created_idx" ON "agent_insights" USING btree ("user_id","agent_key","created_at");--> statement-breakpoint
CREATE INDEX "workouts_user_start_idx" ON "workouts" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "workouts_user_type_start_idx" ON "workouts" USING btree ("user_id","workout_type","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_external_id_idx" ON "workouts" USING btree ("external_id");