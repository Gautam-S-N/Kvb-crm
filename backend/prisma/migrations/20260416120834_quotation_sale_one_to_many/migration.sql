-- DropForeignKey
ALTER TABLE `sales` DROP FOREIGN KEY `sales_quotationId_fkey`;

-- DropIndex
DROP INDEX `sales_quotationId_key` ON `sales`;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
