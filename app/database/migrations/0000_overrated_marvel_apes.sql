CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text,
	`description` text,
	`ip_address` text,
	`user_agent` text,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource`,`resource_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`group` text,
	`description` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_slug_idx` ON `permissions` (`slug`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`role_id`, `permission_id`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_slug_idx` ON `roles` (`slug`);--> statement-breakpoint
CREATE TABLE `school_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`type` text DEFAULT 'string' NOT NULL,
	`group` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_settings_key_idx` ON `school_settings` (`key`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `role_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_roles_user_idx` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`phone` text,
	`gender` text,
	`avatar_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`email_verified_at` text,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `academic_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`is_current` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `academic_sessions_slug_idx` ON `academic_sessions` (`slug`);--> statement-breakpoint
CREATE TABLE `class_subjects` (
	`class_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`is_compulsory` integer DEFAULT true NOT NULL,
	`max_score` integer,
	`created_at` text NOT NULL,
	PRIMARY KEY(`class_id`, `subject_id`),
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `class_subjects_subject_idx` ON `class_subjects` (`subject_id`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`level` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_slug_idx` ON `classes` (`slug`);--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`capacity` integer,
	`room` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sections_class_slug_idx` ON `sections` (`class_id`,`slug`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`code` text,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_slug_idx` ON `subjects` (`slug`);--> statement-breakpoint
CREATE TABLE `terms` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sequence` integer NOT NULL,
	`start_date` text,
	`end_date` text,
	`is_current` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terms_session_slug_idx` ON `terms` (`session_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `terms_session_seq_idx` ON `terms` (`session_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `parents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`other_names` text,
	`email` text,
	`phone` text,
	`gender` text,
	`occupation` text,
	`address` text,
	`photo_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `parents_user_idx` ON `parents` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `parents_email_idx` ON `parents` (`email`);--> statement-breakpoint
CREATE TABLE `staff_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`staff_number` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`other_names` text,
	`job_title` text,
	`department` text,
	`email` text,
	`phone` text,
	`gender` text,
	`hired_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_profiles_staff_no_idx` ON `staff_profiles` (`staff_number`);--> statement-breakpoint
CREATE TABLE `student_parents` (
	`student_id` text NOT NULL,
	`parent_id` text NOT NULL,
	`relationship` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_emergency_contact` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`student_id`, `parent_id`),
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `parents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `student_parents_parent_idx` ON `student_parents` (`parent_id`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`admission_number` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`other_names` text,
	`gender` text,
	`date_of_birth` text,
	`blood_group` text,
	`nationality` text,
	`religion` text,
	`address` text,
	`photo_url` text,
	`status` text DEFAULT 'applicant' NOT NULL,
	`current_class_id` text,
	`current_section_id` text,
	`enrolled_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`current_class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_admission_no_idx` ON `students` (`admission_number`);--> statement-breakpoint
CREATE INDEX `students_user_idx` ON `students` (`user_id`);--> statement-breakpoint
CREATE INDEX `students_status_idx` ON `students` (`status`);--> statement-breakpoint
CREATE TABLE `teachers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`staff_number` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`other_names` text,
	`email` text,
	`phone` text,
	`gender` text,
	`qualification` text,
	`specialization` text,
	`address` text,
	`photo_url` text,
	`hired_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teachers_staff_no_idx` ON `teachers` (`staff_number`);--> statement-breakpoint
CREATE INDEX `teachers_user_idx` ON `teachers` (`user_id`);--> statement-breakpoint
CREATE TABLE `student_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text,
	`class_id` text NOT NULL,
	`section_id` text,
	`roll_number` text,
	`enrollment_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `enrollments_student_idx` ON `student_enrollments` (`student_id`);--> statement-breakpoint
CREATE INDEX `enrollments_session_idx` ON `student_enrollments` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_unique_idx` ON `student_enrollments` (`student_id`,`session_id`,`term_id`,`class_id`,`section_id`);--> statement-breakpoint
CREATE TABLE `teacher_class_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`class_id` text NOT NULL,
	`section_id` text,
	`subject_id` text NOT NULL,
	`session_id` text NOT NULL,
	`is_primary_teacher` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tca_teacher_idx` ON `teacher_class_assignments` (`teacher_id`);--> statement-breakpoint
CREATE INDEX `tca_class_idx` ON `teacher_class_assignments` (`class_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tca_unique_idx` ON `teacher_class_assignments` (`teacher_id`,`class_id`,`section_id`,`subject_id`,`session_id`);--> statement-breakpoint
CREATE TABLE `teacher_subjects` (
	`teacher_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`teacher_id`, `subject_id`),
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `teacher_subjects_subject_idx` ON `teacher_subjects` (`subject_id`);--> statement-breakpoint
CREATE TABLE `timetable_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text,
	`class_id` text NOT NULL,
	`section_id` text,
	`subject_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`room` text,
	`weekday` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `timetable_class_idx` ON `timetable_entries` (`class_id`,`section_id`,`weekday`);--> statement-breakpoint
CREATE INDEX `timetable_teacher_idx` ON `timetable_entries` (`teacher_id`,`weekday`);--> statement-breakpoint
CREATE INDEX `timetable_room_idx` ON `timetable_entries` (`room`,`weekday`);--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`attendance_session_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text NOT NULL,
	`remark` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `att_records_unique_idx` ON `attendance_records` (`attendance_session_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `att_records_student_idx` ON `attendance_records` (`student_id`);--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text,
	`class_id` text NOT NULL,
	`section_id` text,
	`date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`marked_by_id` text,
	`approved_by_id` text,
	`approved_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`marked_by_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`approved_by_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `att_sessions_unique_idx` ON `attendance_sessions` (`session_id`,`term_id`,`class_id`,`section_id`,`date`);--> statement-breakpoint
CREATE INDEX `att_sessions_class_idx` ON `attendance_sessions` (`class_id`,`date`);--> statement-breakpoint
CREATE TABLE `assignment_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`uploaded_by_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `assignment_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`student_id` text NOT NULL,
	`text_content` text,
	`object_key` text,
	`file_name` text,
	`mime_type` text,
	`size_bytes` integer,
	`submitted_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`score` integer,
	`feedback` text,
	`graded_by_id` text,
	`graded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`graded_by_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_unique_idx` ON `assignment_submissions` (`assignment_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `submissions_student_idx` ON `assignment_submissions` (`student_id`);--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`class_id` text NOT NULL,
	`section_id` text,
	`subject_id` text NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text,
	`title` text NOT NULL,
	`instructions` text,
	`max_score` integer DEFAULT 100 NOT NULL,
	`due_date` text,
	`published_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `assignments_class_idx` ON `assignments` (`class_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `assignments_teacher_idx` ON `assignments` (`teacher_id`);--> statement-breakpoint
CREATE TABLE `assessment_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text,
	`assessment_type_id` text NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer DEFAULT 10000 NOT NULL,
	`entered_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assessment_type_id`) REFERENCES `assessment_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`entered_by_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_scores_unique_idx` ON `assessment_scores` (`student_id`,`subject_id`,`session_id`,`term_id`,`assessment_type_id`);--> statement-breakpoint
CREATE INDEX `assessment_scores_student_idx` ON `assessment_scores` (`student_id`,`session_id`,`term_id`);--> statement-breakpoint
CREATE TABLE `assessment_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`weight` integer DEFAULT 100 NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_types_slug_idx` ON `assessment_types` (`slug`);--> statement-breakpoint
CREATE TABLE `exam_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_subject_id` text NOT NULL,
	`student_id` text NOT NULL,
	`score` integer NOT NULL,
	`grade` text,
	`entered_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exam_subject_id`) REFERENCES `exam_subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entered_by_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_scores_unique_idx` ON `exam_scores` (`exam_subject_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `exam_scores_student_idx` ON `exam_scores` (`student_id`);--> statement-breakpoint
CREATE TABLE `exam_subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`max_score` integer DEFAULT 10000 NOT NULL,
	`exam_date` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_subjects_unique_idx` ON `exam_subjects` (`exam_id`,`subject_id`);--> statement-breakpoint
CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text,
	`class_id` text NOT NULL,
	`name` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'closed' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exams_class_idx` ON `exams` (`class_id`,`session_id`,`term_id`);--> statement-breakpoint
CREATE TABLE `grading_scale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`scale_id` text NOT NULL,
	`grade` text NOT NULL,
	`min_score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`remark` text,
	`points` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`scale_id`) REFERENCES `grading_scales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grading_items_scale_grade_idx` ON `grading_scale_items` (`scale_id`,`grade`);--> statement-breakpoint
CREATE TABLE `grading_scales` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `grading_scales_name_idx` ON `grading_scales` (`name`);--> statement-breakpoint
CREATE TABLE `report_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text NOT NULL,
	`class_id` text NOT NULL,
	`section_id` text,
	`total_score` integer,
	`average_score` integer,
	`overall_grade` text,
	`attendance_summary` text,
	`teacher_remark` text,
	`principal_remark` text,
	`object_key` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`generated_by_id` text,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_cards_unique_idx` ON `report_cards` (`student_id`,`session_id`,`term_id`);--> statement-breakpoint
CREATE INDEX `report_cards_student_idx` ON `report_cards` (`student_id`);--> statement-breakpoint
CREATE TABLE `result_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text NOT NULL,
	`class_id` text NOT NULL,
	`section_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_by_id` text,
	`submitted_at` text,
	`approved_by_id` text,
	`approved_at` text,
	`published_by_id` text,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`submitted_by_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`published_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `result_publications_unique_idx` ON `result_publications` (`session_id`,`term_id`,`class_id`,`section_id`);--> statement-breakpoint
CREATE TABLE `fee_items` (
	`id` text PRIMARY KEY NOT NULL,
	`fee_structure_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`amount` integer NOT NULL,
	`is_optional` integer DEFAULT false NOT NULL,
	`due_date` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`fee_structure_id`) REFERENCES `fee_structures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fee_structures` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`class_id` text,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `fee_structures_session_idx` ON `fee_structures` (`session_id`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`fee_item_id` text,
	`description` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_amount` integer NOT NULL,
	`line_total` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `student_invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fee_item_id`) REFERENCES `fee_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `payment_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_number` text NOT NULL,
	`payment_id` text NOT NULL,
	`object_key` text,
	`issued_by_id` text,
	`issued_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`issued_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_receipts_no_idx` ON `payment_receipts` (`receipt_number`);--> statement-breakpoint
CREATE INDEX `payment_receipts_payment_idx` ON `payment_receipts` (`payment_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_reference` text NOT NULL,
	`invoice_id` text NOT NULL,
	`student_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_reference` text,
	`idempotency_key` text,
	`webhook_payload` text,
	`paid_at` text,
	`verified_at` text,
	`verified_by_id` text,
	`refunded_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `student_invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`verified_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_reference_idx` ON `payments` (`payment_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_idempotency_idx` ON `payments` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payments_student_idx` ON `payments` (`student_id`);--> statement-breakpoint
CREATE TABLE `student_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_number` text NOT NULL,
	`student_id` text NOT NULL,
	`session_id` text NOT NULL,
	`term_id` text,
	`issue_date` text NOT NULL,
	`due_date` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`amount_paid` integer DEFAULT 0 NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_invoices_no_idx` ON `student_invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `student_invoices_student_idx` ON `student_invoices` (`student_id`,`session_id`,`term_id`);--> statement-breakpoint
CREATE TABLE `admission_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`application_number` text NOT NULL,
	`session_id` text,
	`intended_class_id` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`other_names` text,
	`gender` text,
	`date_of_birth` text,
	`nationality` text,
	`guardian_name` text,
	`guardian_phone` text,
	`guardian_email` text,
	`address` text,
	`status` text DEFAULT 'applied' NOT NULL,
	`previous_school` text,
	`decision_notes` text,
	`reviewed_by_id` text,
	`reviewed_at` text,
	`decided_at` text,
	`admitted_student_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`intended_class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admission_apps_no_idx` ON `admission_applications` (`application_number`);--> statement-breakpoint
CREATE INDEX `admission_apps_status_idx` ON `admission_applications` (`status`);--> statement-breakpoint
CREATE TABLE `admission_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`title` text NOT NULL,
	`assessment_type` text,
	`scheduled_at` text,
	`score` text,
	`result` text,
	`assessor_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `admission_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assessor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `admission_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`document_type` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `admission_applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`audience` text DEFAULT 'all' NOT NULL,
	`class_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_for` text,
	`author_id` text,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `announcements_status_idx` ON `announcements` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `learning_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`class_id` text,
	`subject_id` text,
	`uploaded_by_id` text,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text,
	`recipient_id` text NOT NULL,
	`direction` text DEFAULT 'outbound' NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_recipient_idx` ON `messages` (`recipient_id`,`is_read`);--> statement-breakpoint
CREATE INDEX `messages_sender_idx` ON `messages` (`sender_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`status` text DEFAULT 'unread' NOT NULL,
	`read_at` text,
	`announcement_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_user_announcement_idx` ON `notifications` (`user_id`,`announcement_id`) WHERE announcement_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`location` text,
	`audience` text DEFAULT 'all' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `events_starts_idx` ON `events` (`starts_at`);--> statement-breakpoint
CREATE TABLE `gallery_albums` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_object_key` text,
	`event_id` text,
	`is_published` integer DEFAULT true NOT NULL,
	`created_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `gallery_images` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`object_key` text NOT NULL,
	`thumb_object_key` text,
	`file_name` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`caption` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `gallery_albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gallery_images_album_idx` ON `gallery_images` (`album_id`);