-- Phase 18C: contact inbox for the public website contact form.
-- Messages are submitted unauthenticated (honeypot + IP rate limits on
-- the route) and triaged by staff with the `contact_messages.view`
-- permission. Rows are never public.
CREATE TABLE `contact_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`department` text,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	CONSTRAINT `contact_messages_status_check` CHECK (`status` IN ('new','read','archived'))
);
--> statement-breakpoint
CREATE INDEX `contact_messages_status_idx` ON `contact_messages` (`status`,`created_at`);
