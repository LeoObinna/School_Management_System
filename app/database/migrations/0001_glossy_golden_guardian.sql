DROP INDEX "parents_email_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_staff_no_idx" ON "staff_profiles" USING btree ("staff_number");--> statement-breakpoint
CREATE UNIQUE INDEX "parents_email_idx" ON "parents" USING btree ("email");