ALTER TABLE "health_samples" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "health_samples_external_id_idx" ON "health_samples" USING btree ("external_id");