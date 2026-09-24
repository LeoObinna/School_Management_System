-- Phase 14B: staff document library (R2-backed, D1 metadata).
-- Documents are never public; bytes stream through the authorized
-- download endpoint. owner_type/owner_id is polymorphic:
--   'school' + null           -> school-wide staff document
--   'staff'  + staff_profiles.id -> document attached to a staff member
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text DEFAULT 'school' NOT NULL,
	`owner_id` text,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`title` text NOT NULL,
	`description` text,
	`category` text,
	`visibility` text DEFAULT 'staff' NOT NULL,
	`created_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `documents_visibility_check` CHECK (`visibility` IN ('staff','admin'))
);
--> statement-breakpoint
CREATE INDEX `documents_owner_idx` ON `documents` (`owner_type`,`owner_id`);
--> statement-breakpoint
CREATE INDEX `documents_visibility_idx` ON `documents` (`visibility`);
--> statement-breakpoint
CREATE INDEX `documents_category_idx` ON `documents` (`category`);
