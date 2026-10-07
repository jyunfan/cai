CREATE TABLE `live_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room` text NOT NULL,
	`round` integer NOT NULL,
	`player` text NOT NULL,
	`choice` integer NOT NULL,
	`correct` integer NOT NULL,
	`rank` integer NOT NULL,
	`points` integer NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `live_rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player`) REFERENCES `live_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_one_answer` ON `live_answers` (`room`,`round`,`player`);--> statement-breakpoint
CREATE TABLE `live_players` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `live_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_player_name` ON `live_players` (`room`,`name`);--> statement-breakpoint
CREATE TABLE `live_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`title` text NOT NULL,
	`questions` text NOT NULL,
	`phase` text DEFAULT 'lobby' NOT NULL,
	`round` integer DEFAULT -1 NOT NULL,
	`seconds` integer NOT NULL,
	`deadline` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
