ALTER TABLE "agent_insights" ADD COLUMN "consent_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_insights" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;