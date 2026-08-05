CREATE TABLE "workflow_dependencies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_workflow_id" uuid NOT NULL,
	"source_version_id" uuid,
	"target_workflow_id" uuid NOT NULL,
	"target_version_number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"label" text,
	"notes" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"draft_definition" jsonb NOT NULL,
	"latest_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_dependencies" ADD CONSTRAINT "workflow_dependencies_source_workflow_id_workflows_id_fk" FOREIGN KEY ("source_workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_dependencies" ADD CONSTRAINT "workflow_dependencies_source_version_id_workflow_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."workflow_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_dependencies" ADD CONSTRAINT "workflow_dependencies_target_workflow_id_workflows_id_fk" FOREIGN KEY ("target_workflow_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_test_cases" ADD CONSTRAINT "workflow_test_cases_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_dependencies_target_idx" ON "workflow_dependencies" USING btree ("target_workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_dependencies_source_idx" ON "workflow_dependencies" USING btree ("source_workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_events_workflow_id_idx" ON "workflow_events" USING btree ("workflow_id","id");--> statement-breakpoint
CREATE INDEX "workflow_test_cases_workflow_id_idx" ON "workflow_test_cases" USING btree ("workflow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_versions_workflow_id_version_uq" ON "workflow_versions" USING btree ("workflow_id","version_number");--> statement-breakpoint
CREATE INDEX "workflows_owner_id_idx" ON "workflows" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_owner_id_name_uq" ON "workflows" USING btree ("owner_id","name");