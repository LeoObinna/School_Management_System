-- Phase 16D: teacher lesson notes (text + optional R2 attachments).
-- Notes are owned by the authoring teacher; admins manage all. Bytes
-- live in R2 under the `lesson-notes/` prefix; D1 stores metadata only.
CREATE TABLE `lesson_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`class_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text,
	`week` integer,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `lesson_notes_teacher_idx` ON `lesson_notes` (`teacher_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `lesson_notes_class_idx` ON `lesson_notes` (`class_id`,`session_id`);
--> statement-breakpoint
CREATE TABLE `lesson_note_files` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`uploaded_by_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `lesson_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `lesson_note_files_note_idx` ON `lesson_note_files` (`note_id`);
