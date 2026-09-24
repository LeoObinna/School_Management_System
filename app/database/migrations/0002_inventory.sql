-- Phase 14C: inventory ledger (books/equipment stock catalog).
-- Bulk-quantity stock tracking; loans/issuing are a later increment.
-- The service enforces 0 <= available_quantity <= quantity.
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`item_type` text DEFAULT 'book' NOT NULL,
	`category` text,
	`identifier` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`available_quantity` integer DEFAULT 1 NOT NULL,
	`location` text,
	`condition` text DEFAULT 'good' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `inventory_items_item_type_check` CHECK (`item_type` IN ('book','equipment')),
	CONSTRAINT `inventory_items_condition_check` CHECK (`condition` IN ('new','good','fair','poor','damaged')),
	CONSTRAINT `inventory_items_status_check` CHECK (`status` IN ('active','retired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_items_identifier_idx` ON `inventory_items` (`item_type`,`identifier`);
--> statement-breakpoint
CREATE INDEX `inventory_items_type_idx` ON `inventory_items` (`item_type`);
--> statement-breakpoint
CREATE INDEX `inventory_items_category_idx` ON `inventory_items` (`category`);
--> statement-breakpoint
CREATE INDEX `inventory_items_status_idx` ON `inventory_items` (`status`);
