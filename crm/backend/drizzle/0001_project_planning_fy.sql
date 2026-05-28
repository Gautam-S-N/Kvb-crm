-- ============================================================
-- Migration 0001: Project Planning Module + Financial Year
-- ============================================================

-- 1. Add financialYear to existing tables
ALTER TABLE `leads`           ADD COLUMN `financialYear` varchar(10) NULL;
ALTER TABLE `quotations`      ADD COLUMN `financialYear` varchar(10) NULL;
ALTER TABLE `sales`           ADD COLUMN `financialYear` varchar(10) NULL;
ALTER TABLE `purchase_orders` ADD COLUMN `financialYear` varchar(10) NULL;
ALTER TABLE `tasks`           ADD COLUMN `financialYear` varchar(10) NULL;

-- 2. Add canCreateProjectPlans to users
ALTER TABLE `users` ADD COLUMN `canCreateProjectPlans` boolean NOT NULL DEFAULT false;

-- 3. Backfill financialYear for all existing records
-- leads — based on createdAt
UPDATE `leads` SET `financialYear` =
  CASE WHEN MONTH(`createdAt`) >= 4
    THEN CONCAT(YEAR(`createdAt`), '-', RIGHT(YEAR(`createdAt`) + 1, 2))
    ELSE CONCAT(YEAR(`createdAt`) - 1, '-', RIGHT(YEAR(`createdAt`), 2))
  END
WHERE `financialYear` IS NULL;

-- quotations — based on quotationDate
UPDATE `quotations` SET `financialYear` =
  CASE WHEN MONTH(`quotationDate`) >= 4
    THEN CONCAT(YEAR(`quotationDate`), '-', RIGHT(YEAR(`quotationDate`) + 1, 2))
    ELSE CONCAT(YEAR(`quotationDate`) - 1, '-', RIGHT(YEAR(`quotationDate`), 2))
  END
WHERE `financialYear` IS NULL;

-- sales — based on saleDate
UPDATE `sales` SET `financialYear` =
  CASE WHEN MONTH(`saleDate`) >= 4
    THEN CONCAT(YEAR(`saleDate`), '-', RIGHT(YEAR(`saleDate`) + 1, 2))
    ELSE CONCAT(YEAR(`saleDate`) - 1, '-', RIGHT(YEAR(`saleDate`), 2))
  END
WHERE `financialYear` IS NULL;

-- purchase_orders — based on orderDate
UPDATE `purchase_orders` SET `financialYear` =
  CASE WHEN MONTH(`orderDate`) >= 4
    THEN CONCAT(YEAR(`orderDate`), '-', RIGHT(YEAR(`orderDate`) + 1, 2))
    ELSE CONCAT(YEAR(`orderDate`) - 1, '-', RIGHT(YEAR(`orderDate`), 2))
  END
WHERE `financialYear` IS NULL;

-- tasks — based on createdAt
UPDATE `tasks` SET `financialYear` =
  CASE WHEN MONTH(`createdAt`) >= 4
    THEN CONCAT(YEAR(`createdAt`), '-', RIGHT(YEAR(`createdAt`) + 1, 2))
    ELSE CONCAT(YEAR(`createdAt`) - 1, '-', RIGHT(YEAR(`createdAt`), 2))
  END
WHERE `financialYear` IS NULL;

-- 4. Create new tables

CREATE TABLE `project_plans` (
  `id`            varchar(36) NOT NULL,
  `projectName`   varchar(255) NOT NULL,
  `place`         varchar(255) NOT NULL,
  `status`        varchar(255) NOT NULL DEFAULT 'ACTIVE',
  `financialYear` varchar(10) NOT NULL,
  `isArchived`    boolean NOT NULL DEFAULT false,
  `completedAt`   timestamp NULL,
  `createdById`   varchar(36) NOT NULL,
  `createdAt`     timestamp NOT NULL DEFAULT (now()),
  `updatedAt`     timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `project_plans_id` PRIMARY KEY(`id`)
);

CREATE TABLE `project_plan_items` (
  `id`              varchar(36) NOT NULL,
  `projectPlanId`   varchar(36) NOT NULL,
  `category`        varchar(50) NOT NULL,
  `itemName`        varchar(255) NOT NULL,
  `size`            varchar(255),
  `quantity`        decimal(15,2) NOT NULL,
  `supplierName`    varchar(255),
  `remarks`         text,
  `fulfillmentType` varchar(50) NOT NULL DEFAULT 'PENDING',
  `reservedQty`     decimal(15,2) NOT NULL DEFAULT '0.00',
  `collectedQty`    decimal(15,2) NOT NULL DEFAULT '0.00',
  `inventoryItemId` varchar(36),
  `purchaseOrderId` varchar(36),
  `createdAt`       timestamp NOT NULL DEFAULT (now()),
  `updatedAt`       timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `project_plan_items_id` PRIMARY KEY(`id`)
);

CREATE TABLE `project_inventory_reservations` (
  `id`            varchar(36) NOT NULL,
  `projectPlanId` varchar(36) NOT NULL,
  `projectItemId` varchar(36) NOT NULL,
  `materialId`    varchar(36) NOT NULL,
  `reservedQty`   decimal(15,2) NOT NULL,
  `releasedQty`   decimal(15,2) NOT NULL DEFAULT '0.00',
  `status`        varchar(50) NOT NULL DEFAULT 'ACTIVE',
  `createdAt`     timestamp NOT NULL DEFAULT (now()),
  `updatedAt`     timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `project_inventory_reservations_id` PRIMARY KEY(`id`)
);

CREATE TABLE `project_collection_tasks` (
  `id`            varchar(36) NOT NULL,
  `projectPlanId` varchar(36) NOT NULL,
  `projectItemId` varchar(36) NOT NULL,
  `assignedToId`  varchar(36) NOT NULL,
  `assignedById`  varchar(36) NOT NULL,
  `qtyToCollect`  decimal(15,2) NOT NULL,
  `qtyCollected`  decimal(15,2) NOT NULL DEFAULT '0.00',
  `status`        varchar(50) NOT NULL DEFAULT 'PENDING',
  `note`          text,
  `collectedAt`   timestamp NULL,
  `createdAt`     timestamp NOT NULL DEFAULT (now()),
  `updatedAt`     timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `project_collection_tasks_id` PRIMARY KEY(`id`)
);

CREATE TABLE `material_usage_history` (
  `id`            varchar(36) NOT NULL,
  `materialId`    varchar(36) NOT NULL,
  `projectPlanId` varchar(36) NOT NULL,
  `projectName`   varchar(255) NOT NULL,
  `action`        varchar(50) NOT NULL,
  `qty`           decimal(15,2) NOT NULL,
  `performedById` varchar(36) NOT NULL,
  `note`          text,
  `createdAt`     timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `material_usage_history_id` PRIMARY KEY(`id`)
);
