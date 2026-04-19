-- DropForeignKey
ALTER TABLE `sales` DROP FOREIGN KEY `sales_quotationId_fkey`;

-- DropIndex
DROP INDEX `sales_quotationId_key` ON `sales`;
