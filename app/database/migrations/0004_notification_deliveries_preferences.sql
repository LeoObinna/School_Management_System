-- Phase 17A–17D: external notification delivery tracking, per-user
-- notification preferences, and newsletter subscriptions.

-- ---------------------------------------------------------------------------
-- Notification delivery log (one row per external channel attempt)
-- ---------------------------------------------------------------------------
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text,
	`channel` text NOT NULL CHECK (`channel` IN ('email', 'sms')),
	`recipient_address` text NOT NULL,
	`provider` text NOT NULL CHECK (`provider` IN ('resend', 'termii')),
	`provider_message_id` text,
	`status` text NOT NULL DEFAULT 'pending' CHECK (`status` IN ('pending', 'sent', 'bounced', 'failed')),
	`sent_at` text,
	`error_message` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_notification_channel_idx` ON `notification_deliveries` (`notification_id`, `channel`);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_recipient_created_idx` ON `notification_deliveries` (`recipient_address`, `created_at`);

-- ---------------------------------------------------------------------------
-- Per-user notification preferences (opt-in/opt-out per channel and event)
-- ---------------------------------------------------------------------------
CREATE TABLE `user_notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`announcement_email` integer NOT NULL DEFAULT 1,
	`fee_reminder_email` integer NOT NULL DEFAULT 1,
	`result_published_email` integer NOT NULL DEFAULT 1,
	`payment_receipt_email` integer NOT NULL DEFAULT 1,
	`urgent_sms` integer NOT NULL DEFAULT 1,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- ---------------------------------------------------------------------------
-- Newsletter subscriptions (public, independent of portal accounts)
-- ---------------------------------------------------------------------------
CREATE TABLE `newsletter_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`status` text NOT NULL DEFAULT 'subscribed' CHECK (`status` IN ('subscribed', 'unsubscribed')),
	`subscribed_at` text,
	`unsubscribed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscriptions_email_idx` ON `newsletter_subscriptions` (`email`);
