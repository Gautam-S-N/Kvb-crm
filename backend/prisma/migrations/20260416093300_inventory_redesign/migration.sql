/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `activity_logs` table. All the data in the column will be lost.
  - You are about to drop the column `newData` on the `activity_logs` table. All the data in the column will be lost.
  - You are about to drop the column `oldData` on the `activity_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `activity_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `activity_logs` table. All the data in the column will be lost.
  - Added the required column `performedBy` to the `activity_logs` table without a default value. This is not possible if the table is not empty.
  - Made the column `entityId` on table `activity_logs` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `settings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `activity_logs` DROP COLUMN `ipAddress`,
    DROP COLUMN `newData`,
    DROP COLUMN `oldData`,
    DROP COLUMN `userAgent`,
    DROP COLUMN `userId`,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `performedBy` VARCHAR(191) NOT NULL,
    MODIFY `entityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `hsnCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `purchase_order_items` ADD COLUMN `materialId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `settings` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `tasks` ADD COLUMN `attachmentUrl` VARCHAR(191) NULL,
    ADD COLUMN `failureReason` TEXT NULL;

-- CreateTable
CREATE TABLE `materials` (
    `id` VARCHAR(191) NOT NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `itemCode` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'Nos',
    `inQty` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `outQty` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `minQuantity` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `rate` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalValue` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `location` VARCHAR(191) NULL,
    `projectSite` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `date` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `materials_itemCode_key`(`itemCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
