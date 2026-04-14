-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'EMPLOYEE', 'USER') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `avatar` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `contactName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `alternatePhone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'India',
    `gstNumber` VARCHAR(191) NULL,
    `facebookPsid` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customers_phone_email_idx`(`phone`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` VARCHAR(191) NOT NULL,
    `leadNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('NEW', 'INQUIRY', 'FOLLOW_UP', 'QUOTATION_SENT', 'ORDER_CONFIRMED', 'WON', 'LOST', 'UNQUALIFIED') NOT NULL DEFAULT 'NEW',
    `source` ENUM('FACEBOOK', 'GOOGLE', 'WHATSAPP', 'JUSTDIAL', 'FIELD_MARKETING', 'REFERRAL', 'WEBSITE', 'WALK_IN', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `estimateAmount` DECIMAL(15, 2) NULL,
    `closeDate` DATETIME(3) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leads_leadNumber_key`(`leadNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_products` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `notes` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_timeline` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `oldValue` VARCHAR(191) NULL,
    `newValue` VARCHAR(191) NULL,
    `performedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `follow_ups` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('CALL', 'WHATSAPP', 'EMAIL', 'MEETING') NOT NULL,
    `description` TEXT NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'OVERDUE') NOT NULL DEFAULT 'SCHEDULED',
    `outcome` TEXT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `follow_up_reminders` (
    `id` VARCHAR(191) NOT NULL,
    `followUpId` VARCHAR(191) NOT NULL,
    `reminderVia` VARCHAR(191) NOT NULL,
    `remindBefore` BOOLEAN NOT NULL DEFAULT true,
    `reminderTime` INTEGER NOT NULL,
    `reminderUnit` VARCHAR(191) NOT NULL,
    `isSent` BOOLEAN NOT NULL DEFAULT false,
    `sentAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notes` (
    `id` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `isVoiceNote` BOOLEAN NOT NULL DEFAULT false,
    `voiceUrl` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emails` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `to` VARCHAR(191) NOT NULL,
    `from` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leadId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_messages` (
    `id` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `leadId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_message_campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `campaignName` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'EMAIL', 'FACEBOOK') NOT NULL,
    `messageTemplate` TEXT NOT NULL,
    `subject` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SENDING', 'COMPLETED', 'FAILED', 'PARTIAL') NOT NULL DEFAULT 'DRAFT',
    `totalLeads` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `filterStatus` VARCHAR(191) NULL,
    `filterSource` VARCHAR(191) NULL,
    `filterAssignee` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_message_logs` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'EMAIL', 'FACEBOOK') NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `errorMsg` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sku` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `unitOfMeasure` VARCHAR(191) NOT NULL DEFAULT 'Units',
    `basePrice` DECIMAL(15, 2) NOT NULL,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotations` (
    `id` VARCHAR(191) NOT NULL,
    `quotationNumber` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_SALE', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    `subTotal` DECIMAL(15, 2) NOT NULL,
    `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(15, 2) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL,
    `quotationDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATETIME(3) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `deliveryTerms` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `termsConditions` TEXT NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quotations_quotationNumber_key`(`quotationNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_items` (
    `id` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `discount` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL,
    `totalPrice` DECIMAL(15, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` VARCHAR(191) NOT NULL,
    `saleNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paymentStatus` ENUM('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'UNPAID',
    `subTotal` DECIMAL(15, 2) NOT NULL,
    `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(15, 2) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL,
    `paidAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `balanceAmount` DECIMAL(15, 2) NOT NULL,
    `saleDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expectedDelivery` DATETIME(3) NULL,
    `actualDelivery` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `invoiceUrl` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_saleNumber_key`(`saleNumber`),
    UNIQUE INDEX `sales_quotationId_key`(`quotationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_items` (
    `id` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `discount` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL,
    `totalPrice` DECIMAL(15, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `referenceNumber` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `receiptUrl` VARCHAR(191) NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendors` (
    `id` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `contactName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` VARCHAR(191) NOT NULL,
    `poNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `subTotal` DECIMAL(15, 2) NOT NULL,
    `taxAmount` DECIMAL(15, 2) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expectedDate` DATETIME(3) NULL,
    `receivedDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_orders_poNumber_key`(`poNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `totalPrice` DECIMAL(15, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('PERSONAL', 'TEAM') NOT NULL DEFAULT 'PERSONAL',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `startDate` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `isRecurring` BOOLEAN NOT NULL DEFAULT false,
    `recurrence` VARCHAR(191) NULL,
    `recurrenceEnd` DATETIME(3) NULL,
    `reminderAt` DATETIME(3) NULL,
    `reminderSent` BOOLEAN NOT NULL DEFAULT false,
    `assignmentVoiceUrl` VARCHAR(191) NULL,
    `assignmentVoiceNote` TEXT NULL,
    `completionVoiceUrl` VARCHAR(191) NULL,
    `completionVoiceNote` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_checklist_items` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_reports` (
    `id` VARCHAR(191) NOT NULL,
    `reportDate` DATETIME(3) NOT NULL,
    `leadsCreated` INTEGER NOT NULL DEFAULT 0,
    `leadsContacted` INTEGER NOT NULL DEFAULT 0,
    `followUpsDone` INTEGER NOT NULL DEFAULT 0,
    `quotationsSent` INTEGER NOT NULL DEFAULT 0,
    `salesClosed` INTEGER NOT NULL DEFAULT 0,
    `revenue` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `activities` TEXT NULL,
    `challenges` TEXT NULL,
    `nextDayPlan` TEXT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `daily_reports_employeeId_reportDate_key`(`employeeId`, `reportDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_targets` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `periodType` ENUM('MONTHLY', 'QUARTERLY') NOT NULL DEFAULT 'MONTHLY',
    `periodYear` INTEGER NOT NULL,
    `periodNumber` INTEGER NOT NULL,
    `revenueTarget` DECIMAL(15, 2) NOT NULL,
    `leadsTarget` INTEGER NOT NULL DEFAULT 0,
    `quotationsTarget` INTEGER NOT NULL DEFAULT 0,
    `revenueAchieved` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `leadsAchieved` INTEGER NOT NULL DEFAULT 0,
    `quotationsSent` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_targets_employeeId_periodType_periodYear_periodNumber_key`(`employeeId`, `periodType`, `periodYear`, `periodNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('TASK_ASSIGNED', 'TASK_COMPLETED', 'LEAD_STATUS_CHANGED', 'LEAD_ASSIGNED', 'FOLLOW_UP_DUE', 'PAYMENT_RECEIVED', 'QUOTATION_APPROVED', 'BULK_MESSAGE_DONE', 'TARGET_MILESTONE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_isRead_idx`(`userId`, `isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `oldData` JSON NULL,
    `newData` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_products` ADD CONSTRAINT `lead_products_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_products` ADD CONSTRAINT `lead_products_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_timeline` ADD CONSTRAINT `lead_timeline_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_timeline` ADD CONSTRAINT `lead_timeline_performedBy_fkey` FOREIGN KEY (`performedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_up_reminders` ADD CONSTRAINT `follow_up_reminders_followUpId_fkey` FOREIGN KEY (`followUpId`) REFERENCES `follow_ups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emails` ADD CONSTRAINT `emails_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `whatsapp_messages` ADD CONSTRAINT `whatsapp_messages_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_message_campaigns` ADD CONSTRAINT `bulk_message_campaigns_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_message_logs` ADD CONSTRAINT `bulk_message_logs_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `bulk_message_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_message_logs` ADD CONSTRAINT `bulk_message_logs_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `quotations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `quotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_checklist_items` ADD CONSTRAINT `task_checklist_items_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_reports` ADD CONSTRAINT `daily_reports_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_targets` ADD CONSTRAINT `sales_targets_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_targets` ADD CONSTRAINT `sales_targets_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
