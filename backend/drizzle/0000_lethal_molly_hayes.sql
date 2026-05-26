CREATE TABLE `material_catalog` (
	`id` varchar(36) NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`itemCode` varchar(255),
	`category` varchar(255) NOT NULL,
	`unit` varchar(255) NOT NULL DEFAULT 'Nos',
	`rate` decimal(15,2) NOT NULL DEFAULT '0.00',
	`remarks` text,
	`location` varchar(255),
	`projectSite` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `material_catalog_id` PRIMARY KEY(`id`)
);
