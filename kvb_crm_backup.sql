-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: kvb_crm
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `__drizzle_migrations`
--

DROP TABLE IF EXISTS `__drizzle_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__drizzle_migrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hash` text NOT NULL,
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `__drizzle_migrations`
--

LOCK TABLES `__drizzle_migrations` WRITE;
/*!40000 ALTER TABLE `__drizzle_migrations` DISABLE KEYS */;
INSERT INTO `__drizzle_migrations` VALUES (1,'9574a59dc61f996806c9cbcd34d3c39e8e0800f8fb9d7ac097b607d123d31bf7',1779779254124);
/*!40000 ALTER TABLE `__drizzle_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('3ada8323-08cd-497a-be13-32185b3ad2f5','695205d421b6fc6bae2fb7b7c7be41fca66c2585be6f904cc29ddc1f81f9f5e7','2026-04-16 11:49:06.561','20260416114903_remove_itemcode_unique',NULL,NULL,'2026-04-16 11:49:06.545',1),('4419bf9b-47d7-4a55-a4d5-48c17cfd515d','3476462dc2b56e72d58f5bdf2dbb01f24ad539fe97fc33f06c59ef0d9edfd855',NULL,'20260416120834_quotation_sale_one_to_many','A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260416120834_quotation_sale_one_to_many\n\nDatabase error code: 1826\n\nDatabase error:\nDuplicate foreign key constraint name \'tasks_createdById_fkey\'\n\nPlease check the query number 3 from the migration file.\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name=\"20260416120834_quotation_sale_one_to_many\"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name=\"20260416120834_quotation_sale_one_to_many\"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:225','2026-04-16 12:09:25.256','2026-04-16 12:08:37.110',0),('a2c96112-6cff-4641-9f5e-bc194dd7114d','1a7f567211639badc1d6ea42fa6282c1ddf0636bcb05f65aebdfb6bf198b3336','2026-04-16 09:22:16.766','20260407094821_init',NULL,NULL,'2026-04-16 09:22:14.561',1),('c3b55bf4-84c6-47f0-b529-90a1837e58fc','3476462dc2b56e72d58f5bdf2dbb01f24ad539fe97fc33f06c59ef0d9edfd855','2026-04-16 12:13:28.667','20260416120834_quotation_sale_one_to_many','',NULL,'2026-04-16 12:13:28.667',0),('f7735932-6333-4583-9605-ce1325da8a48','fc0217114ab40cae2fdc91bb8bab3f25a492bcf2e2081eb6b44e537ccbe8cc85','2026-04-16 09:33:03.708','20260416093300_inventory_redesign',NULL,NULL,'2026-04-16 09:33:03.451',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `activity_logs`
--

DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `description` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `performedBy` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_logs`
--

LOCK TABLES `activity_logs` WRITE;
/*!40000 ALTER TABLE `activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bulk_message_campaigns`
--

DROP TABLE IF EXISTS `bulk_message_campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bulk_message_campaigns` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaignName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('WHATSAPP','EMAIL','FACEBOOK') COLLATE utf8mb4_unicode_ci NOT NULL,
  `messageTemplate` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('DRAFT','SENDING','COMPLETED','FAILED','PARTIAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `totalLeads` int NOT NULL DEFAULT '0',
  `sentCount` int NOT NULL DEFAULT '0',
  `failedCount` int NOT NULL DEFAULT '0',
  `scheduledAt` datetime(3) DEFAULT NULL,
  `sentAt` datetime(3) DEFAULT NULL,
  `filterStatus` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filterSource` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filterAssignee` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `bulk_message_campaigns_createdById_fkey` (`createdById`),
  CONSTRAINT `bulk_message_campaigns_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bulk_message_campaigns`
--

LOCK TABLES `bulk_message_campaigns` WRITE;
/*!40000 ALTER TABLE `bulk_message_campaigns` DISABLE KEYS */;
/*!40000 ALTER TABLE `bulk_message_campaigns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bulk_message_logs`
--

DROP TABLE IF EXISTS `bulk_message_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bulk_message_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaignId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `leadId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('WHATSAPP','EMAIL','FACEBOOK') COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `errorMsg` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sentAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `bulk_message_logs_campaignId_fkey` (`campaignId`),
  KEY `bulk_message_logs_leadId_fkey` (`leadId`),
  CONSTRAINT `bulk_message_logs_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `bulk_message_campaigns` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `bulk_message_logs_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bulk_message_logs`
--

LOCK TABLES `bulk_message_logs` WRITE;
/*!40000 ALTER TABLE `bulk_message_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `bulk_message_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contactName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alternatePhone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `city` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pincode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'India',
  `gstNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `facebookPsid` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `customers_phone_email_idx` (`phone`,`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `daily_reports`
--

DROP TABLE IF EXISTS `daily_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_reports` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reportDate` datetime(3) NOT NULL,
  `leadsCreated` int NOT NULL DEFAULT '0',
  `leadsContacted` int NOT NULL DEFAULT '0',
  `followUpsDone` int NOT NULL DEFAULT '0',
  `quotationsSent` int NOT NULL DEFAULT '0',
  `salesClosed` int NOT NULL DEFAULT '0',
  `revenue` decimal(15,2) NOT NULL DEFAULT '0.00',
  `activities` text COLLATE utf8mb4_unicode_ci,
  `challenges` text COLLATE utf8mb4_unicode_ci,
  `nextDayPlan` text COLLATE utf8mb4_unicode_ci,
  `employeeId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `daily_reports_employeeId_reportDate_key` (`employeeId`,`reportDate`),
  CONSTRAINT `daily_reports_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_reports`
--

LOCK TABLES `daily_reports` WRITE;
/*!40000 ALTER TABLE `daily_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `daily_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_counters`
--

DROP TABLE IF EXISTS `document_counters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_counters` (
  `id` varchar(36) NOT NULL,
  `type` varchar(50) NOT NULL,
  `counter` int NOT NULL DEFAULT '0',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_counters`
--

LOCK TABLES `document_counters` WRITE;
/*!40000 ALTER TABLE `document_counters` DISABLE KEYS */;
/*!40000 ALTER TABLE `document_counters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `emails`
--

DROP TABLE IF EXISTS `emails`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `emails` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `to` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sentAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `leadId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `emails_leadId_fkey` (`leadId`),
  CONSTRAINT `emails_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `emails`
--

LOCK TABLES `emails` WRITE;
/*!40000 ALTER TABLE `emails` DISABLE KEYS */;
/*!40000 ALTER TABLE `emails` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `follow_up_reminders`
--

DROP TABLE IF EXISTS `follow_up_reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follow_up_reminders` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `followUpId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reminderVia` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remindBefore` tinyint(1) NOT NULL DEFAULT '1',
  `reminderTime` int NOT NULL,
  `reminderUnit` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isSent` tinyint(1) NOT NULL DEFAULT '0',
  `sentAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `follow_up_reminders_followUpId_fkey` (`followUpId`),
  CONSTRAINT `follow_up_reminders_followUpId_fkey` FOREIGN KEY (`followUpId`) REFERENCES `follow_ups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `follow_up_reminders`
--

LOCK TABLES `follow_up_reminders` WRITE;
/*!40000 ALTER TABLE `follow_up_reminders` DISABLE KEYS */;
/*!40000 ALTER TABLE `follow_up_reminders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `follow_ups`
--

DROP TABLE IF EXISTS `follow_ups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follow_ups` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('CALL','WHATSAPP','EMAIL','MEETING') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheduledAt` datetime(3) NOT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  `status` enum('SCHEDULED','COMPLETED','CANCELLED','OVERDUE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SCHEDULED',
  `outcome` text COLLATE utf8mb4_unicode_ci,
  `leadId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignedToId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `reminderSent` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `follow_ups_leadId_fkey` (`leadId`),
  KEY `follow_ups_assignedToId_fkey` (`assignedToId`),
  CONSTRAINT `follow_ups_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `follow_ups_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `follow_ups`
--

LOCK TABLES `follow_ups` WRITE;
/*!40000 ALTER TABLE `follow_ups` DISABLE KEYS */;
/*!40000 ALTER TABLE `follow_ups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lead_products`
--

DROP TABLE IF EXISTS `lead_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lead_products` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `leadId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `lead_products_leadId_fkey` (`leadId`),
  KEY `lead_products_productId_fkey` (`productId`),
  CONSTRAINT `lead_products_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `lead_products_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lead_products`
--

LOCK TABLES `lead_products` WRITE;
/*!40000 ALTER TABLE `lead_products` DISABLE KEYS */;
/*!40000 ALTER TABLE `lead_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lead_timeline`
--

DROP TABLE IF EXISTS `lead_timeline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lead_timeline` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `leadId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `oldValue` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `newValue` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performedBy` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `lead_timeline_leadId_fkey` (`leadId`),
  KEY `lead_timeline_performedBy_fkey` (`performedBy`),
  CONSTRAINT `lead_timeline_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `lead_timeline_performedBy_fkey` FOREIGN KEY (`performedBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lead_timeline`
--

LOCK TABLES `lead_timeline` WRITE;
/*!40000 ALTER TABLE `lead_timeline` DISABLE KEYS */;
/*!40000 ALTER TABLE `lead_timeline` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads`
--

DROP TABLE IF EXISTS `leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `leadNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('NEW','INQUIRY','FOLLOW_UP','QUOTATION_SENT','ORDER_CONFIRMED','WON','LOST','UNQUALIFIED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NEW',
  `source` enum('FACEBOOK','GOOGLE','WHATSAPP','JUSTDIAL','FIELD_MARKETING','REFERRAL','WEBSITE','WALK_IN','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OTHER',
  `estimateAmount` decimal(15,2) DEFAULT NULL,
  `closeDate` datetime(3) DEFAULT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignedToId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  `isArchived` tinyint(1) NOT NULL DEFAULT '0',
  `snapshotManagerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `leads_leadNumber_key` (`leadNumber`),
  KEY `leads_customerId_fkey` (`customerId`),
  KEY `leads_createdById_fkey` (`createdById`),
  KEY `leads_assignedToId_status_source_idx` (`assignedToId`,`status`,`source`),
  KEY `leads_isArchived_assignedToId_idx` (`isArchived`,`assignedToId`),
  CONSTRAINT `leads_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `leads_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `leads_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads`
--

LOCK TABLES `leads` WRITE;
/*!40000 ALTER TABLE `leads` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_catalog`
--

DROP TABLE IF EXISTS `material_catalog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_catalog` (
  `id` varchar(36) NOT NULL,
  `itemName` varchar(255) NOT NULL,
  `itemCode` varchar(255) DEFAULT NULL,
  `category` varchar(255) NOT NULL,
  `unit` varchar(255) NOT NULL DEFAULT 'Nos',
  `rate` decimal(15,2) NOT NULL DEFAULT '0.00',
  `remarks` text,
  `location` varchar(255) DEFAULT NULL,
  `projectSite` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_catalog`
--

LOCK TABLES `material_catalog` WRITE;
/*!40000 ALTER TABLE `material_catalog` DISABLE KEYS */;
INSERT INTO `material_catalog` VALUES ('019ddae7-daff-4bc4-b47e-7bd46c8c1826','Gear Box','DC3-052','Hardware','Nos',0.00,'30:1','Geared Motor','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('020f4970-0413-433f-a49a-5809ed8c5481','Fasterners','DC3-072','Hardware','Nos',0.00,'3/8-6\"','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('06a21b28-92b3-461d-ae8c-323ac8517895','Sq bar bright','DC3-002','Flat Plate','Nos',0.00,'6000x14','Bar EN-8 Bright',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('080b7f70-69f6-413b-9c87-cc6766895ed3','Channel','DC3-036','C Channel','Nos',0.00,'3000x100x50x5','M S Angle/Beam/Channel','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('0a10fc3d-ded9-4fbd-bf83-4e514a00ceaf','Fastners with double washer','DC3-101','Hardware','Nos',0.00,'1/2 - 4\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('0de8176b-a591-409e-96a9-67d7f587f908','M5x50L','DC3-016','Hardware','Nos',0.00,NULL,'Fasteners',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('1420c887-2f34-422b-b8a0-c175da30ed2c','Sq pipe','DC3-028','Sq. Tube','Nos',0.00,'6000x32x32x3','Tube 32x32','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('15093f38-5e1a-4f7f-a737-adf006d847d6','Battery','DC1-023','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('17aabfb4-ad40-4052-be41-e6ba2bc3430f','Tread Coupling','DC3-096','Hardware','Nos',0.00,'1/2\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('17ab1f28-9c9c-4ed1-aa99-61a7e7e510ed','1.25\" (40 mm) pipe','DC3-025','Round Tube','Nos',0.00,'6000x42x3','MS Seamless','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('19b29f03-3e33-4d3e-840f-960bd5e332bd','MS weld Bend with collar','DC3-085','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('1a33c26b-a123-4e78-b8c0-93c39f672055','Door Lock','DC1-012','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('1a3798c0-0730-45d1-a11f-360e09dc688d','Treading valve','DC3-087','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('1b0da8b7-3a24-46f9-974c-baa7d676e65c','PV pannel','DC3-069','Hardware','Nos',0.00,'40 wp','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('1b7dbeb5-31d7-420c-9b97-60b02ed02c4c','Consumebles','DC3-074','Hardware','Nos',0.00,NULL,'Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('1c2ac757-3dbd-4c87-99ed-6c326f918441','Window','DC1-013','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('1eb73665-43a9-4b07-b39c-8b531f71ff00','Wiring cable','DC3-062','Hardware','Nos',0.00,'1.5 mm 2core','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('1fed89ca-8f33-4d13-8a8a-5191b58792f8','Flat','DC3-009','Flat Plate','Nos',0.00,'130x65x10','Flat MS Black',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('213d1313-9a6f-423f-aca9-4114a27c118c','Charger instrument','DC3-071','Hardware','Nos',0.00,NULL,'Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('2397a466-87b8-4f61-aaf6-831d111efec0','Sq.pipe','DC3-001','Sq. Tube','Nos',0.00,'6000x20x20x3','Tube 20x20',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('244afacb-c719-4dbc-a31b-40e0e5015c8f','Pressure gauge','DC3-082','Hardware','Nos',0.00,'14 kg','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('25104090-46b9-4db7-ae0f-5c1883d5d932','Top Beed','DC1-009','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('27d3d669-7365-4b18-ab5b-db478628f28a','Flat','DC3-010','Flat Plate','Nos',0.00,'150x120x10','Flat MS Black',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('27dafe0a-e829-49d7-9c73-c7c4fe932aba','NRV Tread','DC3-099','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('2928da22-251e-41cc-8222-bbc6ecfd1728','Sq.pipe','DC3-006','Sq. Tube','Nos',0.00,'6000x40x40x3','Tube 40x40',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('29488ca8-e484-428f-996d-ff6769bab8b9','Rubber bush','DC3-079','Hardware','Nos',0.00,'1/2\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('2961d6a0-8f8d-4eac-be75-0a10a0adf7e7','Wire scoket 2 plug','DC3-063','Hardware','Nos',0.00,'2 plug','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('2c9434c9-0489-469b-b512-3bbb7304058f','4\" pipe','DC3-020','Round Tube','Nos',0.00,'2100x114.3x4.78','MS Seamless','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('2cb6f46a-f931-4657-a97d-d838d2426de0','Water level Indicator','DC3-078','Hardware','Nos',0.00,NULL,'Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('2d3f43b9-f8e8-415f-b3ba-007946182ea8','Shaffen Q','DC3-094','Hardware','Nos',0.00,NULL,'Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('2e601856-0784-4572-9d64-1113a9a9ef70','Flat','DC3-045','Flat Plate','Nos',0.00,'1500x32x3','Flat MS Black','Seasonal Adjustment Lever','2026-05-26 01:38:34','2026-05-26 01:38:34'),('2e8c1c46-5e46-4def-afe2-a8577732f7b2','Sq pipe','DC3-030','Sq. Tube','Nos',0.00,'6000x25x25x3','Tube 25x25','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('2f655ba8-9b12-424f-a805-fd0c79d692d3','Block','DC1-029','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('39b10921-3b14-45ee-9dac-3117a22dfd5d','M25x100mm','DC3-015','Hardware','Nos',0.00,NULL,'Fasteners',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('3a90c74f-46f4-4cf6-8176-5670bf52b42f','Teflon tape','DC3-105','Hardware','Nos',0.00,'1','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('3c02bc6c-810d-48c5-8ac3-ecca620561b5','Wiring material','DC1-017','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('40a89146-4c0f-4a32-bedd-7a9774bce008','Flat','DC3-012','Flat Plate','Nos',0.00,'65x50x10','Flat MS Black',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('412b5968-7f83-44b9-bdc7-6143e218aee7','Round bar','DC3-035','Round Rod','Nos',0.00,'6000x20','Bar MS Bright','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('424e2656-be42-4762-b994-47a94ba348be','Control Panel and Sensor','DC1-016','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('427cdf43-4cef-4c96-baf1-75ed8cc907bc','Angle','DC3-032','L Angle','Nos',0.00,'6000x40x40x5','M S Angle/Beam/Channel','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('45f3db40-edf7-4c4a-b57f-5ac487a3618a','Base Frame','DC1-002','Dryer Component','Nos',0.00,'40x40',NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('48616349-106c-48a0-92c6-e6338838faa6','M5xwasher','DC3-040','Hardware','Nos',0.00,NULL,'Fasteners','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('49cfc394-a1c0-4ab0-a3ae-9b554950404e','Round pipe','DC3-034','Round Tube','Nos',0.00,'6000x32x3','MS Seamless','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('4ba724cd-3146-454d-9a67-8cc35202f7d2','Flat','DC3-048','Flat Plate','Nos',0.00,'200x200x10','Flat MS Bright','Receiver Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('4c294257-68bf-4dce-978b-34ab467a58c2','Flat','DC3-026','Flat Plate','Nos',0.00,'200x50x10','Flat MS Black','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('4f35f5ac-9e3a-404b-acff-999320d1f40d','Flange valve','DC3-083','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('51767526-285a-4d1a-84ed-42f607f19299','Drum','DC3-054','Hardware','Nos',0.00,'Assembly','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('568fe025-94db-4f12-bc26-3e393bbf785b','Nut bolt','DC3-100','Hardware','Nos',0.00,'1/2 - 2\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('5751856c-36a8-4f00-889c-568b59ec54c2','Channel','DC3-033','C Channel','Nos',0.00,'6000x75x40x5','M S Angle/Beam/Channel','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('57c25afc-51b6-460a-b86f-2b0f9a6a85ac','Gasket','DC3-092','Hardware','Nos',0.00,'champion','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('58a7497a-08b9-4e2a-aa3c-d2957618f681','Flat','DC3-008','Flat Plate','Nos',0.00,'150x65x10','Flat MS Black',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('5a112034-edec-42c6-bda2-55a9d6ca2f13','Gear box Handle','DC3-065','Hardware','Nos',0.00,'Assembly','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('5b401a2b-51c4-4351-8e6b-3ef126bf121c','Plate','DC3-021','Flat Plate','Nos',0.00,'200x125x10','M S plate HR /Sheet','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('5cb5a298-fc9e-4c66-b484-3e3202335ca9','Circulation fan','DC1-015','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('5e364d08-70da-4eb4-a290-78473d7d4f99','Cutting Machine','DC1-033','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('5e717167-4bb3-4bdc-8816-0c8fb063d278','Battery','DC3-068','Hardware','Nos',0.00,NULL,'Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('5f1102be-13ff-482f-a940-e46c776bcb2d','Heater','DC1-025','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('62d1015c-d38b-4ea1-93a7-2aad8b1e2fb4','Fasterners with washer','DC3-073','Hardware','Nos',0.00,'3/8-2\"','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('656ad482-f315-47bb-ba7a-b416e0cc866c','Wire U clamp 8 mm','DC3-067','Hardware','Nos',0.00,NULL,'Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('65e0ae0d-1bc1-43ae-bd78-b6a7f2f060d4','MS rivit','DC3-044','Hardware','Nos',0.00,NULL,'Fasteners','Seasonal Adjustment','2026-05-26 01:38:34','2026-05-26 01:38:34'),('6811a69a-bcef-4e2c-8ce4-26f617a984cc','Door Material','DC1-004','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('68537e3c-a740-4a22-98da-2b3d2b4d1f44','Plate','DC3-022','Flat Plate','Nos',0.00,'200x65x10','M S plate HR /Sheet','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('6ad6810b-e791-438a-8adc-edcf67cb05dc','Perlin Material','DC1-003','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('6b949fa2-6fb3-4496-8049-4021f5329343','Dish NRV','DC3-104','Hardware','Nos',0.00,'1','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('6c7e7df0-54a8-427d-b702-7e7aba3690bb','Bottom Beed','DC1-010','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('714e14e1-d86c-4412-9cfa-7e11560ca89b','Bright Flat','DC3-007','Flat Plate','Nos',0.00,'6000x40x5','Flat MS Bright',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('71714626-bee4-4d2a-a263-3afba958e394','Welding Shield','DC1-039','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('71e9bd7e-9e6b-474e-8f3c-eeb72bc8ccf4','Flat','DC3-031','Flat Plate','Nos',0.00,'1000x40x3','Flat MS Black','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('7205afba-f879-42bc-83aa-1f003d7a8b24','5/8x2\" Bolt','DC3-049','Hardware','Nos',0.00,NULL,'Fasteners','Receiver Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('751538fa-d88a-45f7-ae34-6538d4f23982','Junction box','DC1-034','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('75dc6233-df2d-4a89-ba23-8ca89cf6531e','Sq,pipe','DC3-005','Sq. Tube','Nos',0.00,'3000x25x25x3','Tube 25x25',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('763e7e32-54ef-473b-aaa5-97393beb93f5','M18 nut','DC3-039','Hardware','Nos',0.00,NULL,'Fasteners','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('774a72a7-5ff9-4ae4-a8ef-24cc01952c27','Name Plate','DC1-031','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('779f2f00-a488-4d99-85e5-350b384659f9','Temp Gauge','DC3-102','Hardware','Nos',0.00,'200 Degree','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('7a169dbd-6bd7-44c7-9e84-feb51a95f765','Qualorific unit','DC1-026','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('7bcf3c32-a4e6-40c9-8808-ffdc8fa17b89','Round plate','DC3-023','Flat Plate','Nos',0.00,'110x110x10','Flat MS Black','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('7c6d399a-a82d-4a80-98a5-6595ab8c5092','Cutting wheel','DC1-036','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('7f516701-1b35-4d5e-b1a6-6da35afb9fc9','Viper Motor','DC3-053','Hardware','Nos',0.00,'DC motor','Geared Motor','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('80d6d0ba-04c6-46b7-8e75-110063ae0f16','Ups','DC3-060','Hardware','Nos',0.00,'Assembly','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('8182727d-7e81-42c4-b2d5-c44593f21e43','Black board paint','DC3-106','Hardware','Nos',0.00,'1','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('84ea33b7-dbd6-4711-9167-49f36ba9337f','MS Union with copper bush','DC3-088','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('853192ad-11be-4615-b8f1-efdb9861f3c6','Rope wire','DC3-058','Hardware','Nos',0.00,'8 mmx 40000','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('8574d822-ea78-47b7-af2f-7ef257e1100a','Round pipe','DC3-042','Round Tube','Nos',0.00,'1500x40x40x3','MS Seamless','Seasonal Adjustment','2026-05-26 01:38:34','2026-05-26 01:38:34'),('85f6c22e-17f5-4f1f-9fb5-7fc1da87dad4','Sprocket','DC3-056','Hardware','Nos',0.00,'1/2\"x 50 T','Chains','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('86478ba2-89e6-45f4-b40d-d3f98aa3e3e6','M5x75L','DC3-017','Hardware','Nos',0.00,NULL,'Fasteners',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('869075a2-84cb-4ef7-819d-5cc2974d5a30','Pipe','DC3-075','Round Tube','Nos',0.00,NULL,'MS Seamless','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('888d6608-3bcb-4727-add5-f0f629711d9d','Rope wire','DC3-059','Hardware','Nos',0.00,'6 mm x 20000','Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('8b03b595-a07a-4ccf-a090-7fca58bdac4a','Anchoring machine','DC1-041','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('8b52a1bc-9e3b-494c-a6ba-2d3dec3cc090','MS T with collar','DC3-089','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('8c656f64-48f1-4aa4-99a2-2a9ffc2610b3','Arch Material','DC1-001','Dryer Component','Nos',0.00,'40x40',NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('8d8ca6a6-a1cf-4e8e-8a1b-5891b3652dfc','Glass tube 1/2\"','DC3-080','Hardware','Nos',0.00,'12 mm','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('8dfe6f0a-4038-445d-87cc-05c5ad218e05','Shaffen valve','DC3-095','Hardware','Nos',0.00,NULL,'Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('8fd16e64-efd1-4957-8c69-0442fbc841f8','Barrel nipple','DC3-084','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('90b9b420-705a-4dd0-957c-e590ed51258a','5/8x2\" Bolt','DC3-024','Hardware','Nos',0.00,NULL,'Fasteners','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('924a9364-0f5e-40be-a7b2-2431d798f27c','Trays','DC1-008','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('930fcbfa-9129-49eb-9899-75fc550b3ae6','Castor Wheels','DC1-007','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('95de7185-3f21-46b9-ae72-c49837ecdd19','Rec pipe','DC3-003','Rec. Tube','Nos',0.00,'6000x50x25','Tube 50x25',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('973917cc-8969-4645-a772-8c28ad1366d5','Limit Switch','DC3-064','Hardware','Nos',0.00,NULL,'Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('97ed6af8-4771-420d-9ce3-613ae3635ffa','Chain','DC3-055','Hardware','Nos',0.00,'1/2\"','Chains','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('a04c0d23-214b-45a2-b2c6-3093a70a1c75','Chanrge controller','DC1-024','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('a3688346-b9bf-4af7-ba11-aae5aec07750','Sealicon tube','DC1-021','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('a3a7c597-4578-4d57-b9cf-28718ccc70c4','Shaffen U','DC3-093','Hardware','Nos',0.00,NULL,'Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('a4d5f075-23da-4807-aec8-cd49fe9efc11','Flat','DC3-011','Flat Plate','Nos',0.00,'90x65x10','Flat MS Black',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('a989b4c3-4e81-48a1-8021-2325811b84c1','Front and rear face material','DC1-005','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('aa783287-5a19-4ed3-8fc5-b06684ba138e','Welding Machine','DC1-032','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('ae9b1978-73cb-4c45-8deb-b145872b79e4','aggregates','DC1-030','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('b00d3178-1a84-42b9-a151-986f0cd21b3b','Sq pipe','DC3-029','Sq. Tube','Nos',0.00,'6000x50x25x3','Tube 50x25','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('b892ca7d-4b93-4ffc-9a2e-ef9a842c9ff7','Flat','DC3-037','Flat Plate','Nos',0.00,'200x200x10','Flat MS Black','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('b9389bfa-cd62-4815-ba4c-7a5fa45a0a7b','M10x100mm','DC3-014','Hardware','Nos',0.00,NULL,'Fasteners',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('ba871a72-f49c-48e0-b1ed-fec458aa5875','Sq.Pipe','DC3-004','Sq. Tube','Nos',0.00,'3000x32x32x3','Tube 32x32',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('bc2da470-41dc-4fc3-a5a0-4f97ba6c6e01','Barrel nipple','DC3-098','Hardware','Nos',0.00,'3/4\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('bc37fd8d-5148-440f-b9d2-72ce5e65cde8','Flange stainer','DC3-086','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('c18a8253-d56c-4eb6-80fd-5f6f17b17328','Gasket','DC3-077','Hardware','Nos',0.00,'champion','Rubber Hose','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('c60b7919-5866-4761-a489-770428d62d9d','Timmer','DC3-061','Hardware','Nos',0.00,NULL,'Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('c642d2c4-60d6-46cc-a352-3dffe030f507','Small gear','DC3-057','Hardware','Nos',0.00,'1/2\" x 9\"','Chains','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('c95333ef-93d7-4ade-b478-0f42c372c87b','M18x100','DC3-038','Hardware','Nos',0.00,NULL,'Fasteners','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('cf64fcb0-0a46-4168-b4f8-cf6db524808d','Channel','DC3-047','C Channel','Nos',0.00,'3000x75x40x5','M S Angle/Beam/Channel','Receiver Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('cfe02693-b5e8-432d-bcb7-919e543e610e','Charger','DC3-070','Hardware','Nos',0.00,NULL,'Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('d0b0a0fc-3ef8-49e3-a546-440483055729','Flat','DC3-050','Flat Plate','Nos',0.00,'200x200x10','M S plate HR /Sheet','Header Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('d0fb804e-2db9-4a2c-8246-161f5d4552be','Wire U clamp 6 mm','DC3-066','Hardware','Nos',0.00,NULL,'Others','Tracking Mechnisum','2026-05-26 01:38:34','2026-05-26 01:38:34'),('d1d4c9f3-428a-4f2a-8e7f-52b20df45ed8','Handle type Safety valve','DC3-081','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('d4c5cc91-7505-48ff-8ced-65dc8c7d39d8','M5x25L','DC3-019','Hardware','Nos',0.00,NULL,'Fasteners',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('d568ea6f-7ff0-41a9-9b6b-ca07f7af114a','Polycarbonate sheet','DC1-018','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('d6e7db7a-4ea0-4aff-a081-d3ebb6316cac','Temp Gauge rod','DC3-103','Hardware','Nos',0.00,'200 Degree','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('d8f832a6-53ce-45a4-9b51-ba38217f0e59','Flange','DC3-076','Flat Plate','Nos',0.00,NULL,'M S plate HR /Sheet','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('d95333f9-90b1-45fb-8d20-6cca7c916c52','Channel','DC3-051','C Channel','Nos',0.00,'6000x75x40x5','M S Angle/Beam/Channel','Header Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('dabde238-53b9-4679-a093-b3f6345f6751','Fasterners','DC1-019','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('dbbec239-1f64-4838-ac80-f7ea4ae6ceba','Round pipe','DC3-043','Round Tube','Nos',0.00,'1500x32x32x3','MS Seamless','Seasonal Adjustment','2026-05-26 01:38:34','2026-05-26 01:38:34'),('dd202cac-6a7b-4b64-864c-c168dbf6fb72','Foundation Tube','DC1-020','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('de5fda84-343b-4b04-bdb1-25b1239035b2','PV Panel','DC1-022','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('e50949b1-39ef-457b-9b8d-f31c22683f47','Trolley material','DC1-006','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('e5ebeb13-81f9-4d73-927d-6deb57fbc610','Table Flange','DC3-091','Hardware','Nos',0.00,'1\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('e64b0f86-0647-42d4-b5af-3220c7c391f5','Tread Coupling','DC3-097','Hardware','Nos',0.00,'1','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('e7c52c27-825e-43e9-9e90-54e80033fcff','Anchoring bolt M12x100','DC3-041','Hardware','Nos',0.00,NULL,'Fasteners','Dish Stand','2026-05-26 01:38:34','2026-05-26 01:38:34'),('e7d1df3b-7ba3-46b8-befe-40ecdbf6dfa4','M5 nut','DC3-018','Hardware','Nos',0.00,NULL,'Fasteners',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('e8263e16-747f-4929-9378-af870edcd4ca','Sealicon feeding gun','DC1-040','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('e942e306-502d-42bd-a87b-7d0fa23e2fcb','Round bar','DC3-046','Round Rod','Nos',0.00,'500x12','Bar MS Black','Seasonal Adjustment Lever','2026-05-26 01:38:34','2026-05-26 01:38:34'),('ec0088df-26a3-42f6-89c2-3bab350a2604','Bar','DC3-027','Round Rod','Nos',0.00,'1000x16','Bar MS Bright','Rotor support','2026-05-26 01:38:34','2026-05-26 01:38:34'),('ec5c955e-09a8-41f3-8ecd-331718c064fb','Exhust Fan','DC1-014','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('ee80bcf7-8a7e-40e5-ae1f-ffa240705b8f','Kadappa Stone','DC1-027','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('ee99f33a-f169-43c0-8af1-98ec3c6654e7','Hand Drilling machine','DC1-038','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('eff12222-29da-4296-9536-cdfd6aaa1a92','Welding rod','DC1-035','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('f2bf32a1-2266-4adb-9ceb-c81dd4141a04','5/8 -2\"L','DC3-013','Hardware','Nos',0.00,NULL,'Fasteners',NULL,'2026-05-26 01:38:34','2026-05-26 01:38:34'),('f547491e-f96c-4269-9a61-1eb67706492c','Cement','DC1-028','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('f6c63d59-f636-4993-a9f5-5db3c0d99cd6','Door Hinge','DC1-011','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33'),('f9e5866d-915f-4d84-93ab-55b4421aa6b2','Barrel nipple','DC3-090','Hardware','Nos',0.00,'1/2\"','Others','Header 4000mm x 10\"','2026-05-26 01:38:34','2026-05-26 01:38:34'),('fd14c745-139d-4352-bca1-8da95beeffce','Granding wheels','DC1-037','Dryer Component','Nos',0.00,NULL,NULL,NULL,'2026-05-26 01:38:33','2026-05-26 01:38:33');
/*!40000 ALTER TABLE `material_catalog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_request_items`
--

DROP TABLE IF EXISTS `material_request_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_request_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `materialRequestId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Nos',
  `quantity` decimal(15,2) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `isPurchased` tinyint(1) NOT NULL DEFAULT '0',
  `purchasedAt` datetime(3) DEFAULT NULL,
  `purchaseNote` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `material_request_items_materialRequestId_fkey` (`materialRequestId`),
  CONSTRAINT `material_request_items_materialRequestId_fkey` FOREIGN KEY (`materialRequestId`) REFERENCES `material_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_request_items`
--

LOCK TABLES `material_request_items` WRITE;
/*!40000 ALTER TABLE `material_request_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_request_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_requests`
--

DROP TABLE IF EXISTS `material_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_requests` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `projectName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('PENDING','IN_PROGRESS','COMPLETE','INCOMPLETE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignedToId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  `completionNote` text COLLATE utf8mb4_unicode_ci,
  `completionVoiceUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failureReason` text COLLATE utf8mb4_unicode_ci,
  `failureVoiceUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `material_requests_createdById_fkey` (`createdById`),
  KEY `material_requests_assignedToId_fkey` (`assignedToId`),
  CONSTRAINT `material_requests_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `material_requests_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_requests`
--

LOCK TABLES `material_requests` WRITE;
/*!40000 ALTER TABLE `material_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `materials`
--

DROP TABLE IF EXISTS `materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `materials` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Nos',
  `inQty` decimal(15,2) NOT NULL DEFAULT '0.00',
  `outQty` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `minQuantity` decimal(15,2) NOT NULL DEFAULT '0.00',
  `rate` decimal(15,2) NOT NULL DEFAULT '0.00',
  `totalValue` decimal(15,2) NOT NULL DEFAULT '0.00',
  `location` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `projectSite` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `date` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `materials`
--

LOCK TABLES `materials` WRITE;
/*!40000 ALTER TABLE `materials` DISABLE KEYS */;
/*!40000 ALTER TABLE `materials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notes`
--

DROP TABLE IF EXISTS `notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notes` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `isVoiceNote` tinyint(1) NOT NULL DEFAULT '0',
  `voiceUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `leadId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notes_leadId_fkey` (`leadId`),
  KEY `notes_createdById_fkey` (`createdById`),
  CONSTRAINT `notes_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `notes_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notes`
--

LOCK TABLES `notes` WRITE;
/*!40000 ALTER TABLE `notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('TASK_ASSIGNED','TASK_COMPLETED','LEAD_STATUS_CHANGED','LEAD_ASSIGNED','FOLLOW_UP_DUE','PAYMENT_RECEIVED','QUOTATION_APPROVED','BULK_MESSAGE_DONE','TARGET_MILESTONE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entityId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT '0',
  `readAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notifications_userId_isRead_idx` (`userId`,`isRead`),
  CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `paymentMethod` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paymentDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `referenceNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receiptUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `saleId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `payments_saleId_fkey` (`saleId`),
  CONSTRAINT `payments_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `sku` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unitOfMeasure` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Units',
  `basePrice` decimal(15,2) NOT NULL,
  `taxRate` decimal(5,2) NOT NULL DEFAULT '18.00',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `hsnCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_sku_key` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_items`
--

DROP TABLE IF EXISTS `purchase_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hsnCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `unit` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Nos',
  `rate` decimal(15,2) NOT NULL DEFAULT '0.00',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_items`
--

LOCK TABLES `purchase_items` WRITE;
/*!40000 ALTER TABLE `purchase_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_order_items`
--

DROP TABLE IF EXISTS `purchase_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchaseOrderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `quantity` int NOT NULL,
  `unitPrice` decimal(15,2) NOT NULL,
  `totalPrice` decimal(15,2) NOT NULL,
  `materialId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hsnCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchaseItemId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `purchase_order_items_purchaseOrderId_fkey` (`purchaseOrderId`),
  KEY `purchase_order_items_materialId_fkey` (`materialId`),
  KEY `purchase_order_items_purchaseItemId_fkey` (`purchaseItemId`),
  CONSTRAINT `purchase_order_items_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `materials` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `purchase_order_items_purchaseItemId_fkey` FOREIGN KEY (`purchaseItemId`) REFERENCES `purchase_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `purchase_order_items_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order_items`
--

LOCK TABLES `purchase_order_items` WRITE;
/*!40000 ALTER TABLE `purchase_order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `poNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('DRAFT','SENT','CONFIRMED','RECEIVED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `subTotal` decimal(15,2) NOT NULL,
  `taxAmount` decimal(15,2) NOT NULL,
  `totalAmount` decimal(15,2) NOT NULL,
  `orderDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expectedDate` datetime(3) DEFAULT NULL,
  `receivedDate` datetime(3) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `pdfUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vendorId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_orders_poNumber_key` (`poNumber`),
  KEY `purchase_orders_createdById_fkey` (`createdById`),
  KEY `purchase_orders_vendorId_fkey` (`vendorId`),
  CONSTRAINT `purchase_orders_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchase_orders_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quotation_counters`
--

DROP TABLE IF EXISTS `quotation_counters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotation_counters` (
  `id` varchar(191) NOT NULL,
  `productCode` varchar(191) NOT NULL,
  `counter` int NOT NULL DEFAULT '0',
  `updatedAt` datetime(3) NOT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `quotation_counters_productCode_key` (`productCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotation_counters`
--

LOCK TABLES `quotation_counters` WRITE;
/*!40000 ALTER TABLE `quotation_counters` DISABLE KEYS */;
/*!40000 ALTER TABLE `quotation_counters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quotation_items`
--

DROP TABLE IF EXISTS `quotation_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotation_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quotationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `quantity` int NOT NULL,
  `unitPrice` decimal(15,2) NOT NULL,
  `discount` decimal(5,2) NOT NULL DEFAULT '0.00',
  `taxRate` decimal(5,2) NOT NULL,
  `totalPrice` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `quotation_items_quotationId_fkey` (`quotationId`),
  KEY `quotation_items_productId_fkey` (`productId`),
  CONSTRAINT `quotation_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `quotation_items_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `quotations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotation_items`
--

LOCK TABLES `quotation_items` WRITE;
/*!40000 ALTER TABLE `quotation_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `quotation_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quotation_reservations`
--

DROP TABLE IF EXISTS `quotation_reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotation_reservations` (
  `id` varchar(191) NOT NULL,
  `productCode` varchar(191) NOT NULL,
  `quotationNumber` varchar(191) NOT NULL,
  `reservedBy` varchar(191) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `quotation_reservations_quotationNumber_key` (`quotationNumber`),
  KEY `quotation_reservations_productCode_expiresAt_idx` (`productCode`,`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotation_reservations`
--

LOCK TABLES `quotation_reservations` WRITE;
/*!40000 ALTER TABLE `quotation_reservations` DISABLE KEYS */;
/*!40000 ALTER TABLE `quotation_reservations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quotations`
--

DROP TABLE IF EXISTS `quotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quotationNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `status` enum('DRAFT','SENT','APPROVED','REJECTED','CONVERTED_TO_SALE','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `subTotal` decimal(15,2) NOT NULL,
  `discountAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discountPercent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `taxAmount` decimal(15,2) NOT NULL,
  `totalAmount` decimal(15,2) NOT NULL,
  `quotationDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `validUntil` datetime(3) DEFAULT NULL,
  `paymentTerms` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deliveryTerms` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `termsConditions` text COLLATE utf8mb4_unicode_ci,
  `pdfUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `leadId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `customFields` json DEFAULT NULL,
  `templateType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'STANDARD',
  `parentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `versionLabel` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'A',
  `originalDate` datetime(3) DEFAULT NULL,
  `isLatest` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `quotations_quotationNumber_key` (`quotationNumber`),
  KEY `quotations_leadId_fkey` (`leadId`),
  KEY `quotations_customerId_fkey` (`customerId`),
  KEY `quotations_createdById_fkey` (`createdById`),
  KEY `quotations_parentId_fkey` (`parentId`),
  CONSTRAINT `quotations_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `quotations_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `quotations_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `quotations_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `quotations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotations`
--

LOCK TABLES `quotations` WRITE;
/*!40000 ALTER TABLE `quotations` DISABLE KEYS */;
/*!40000 ALTER TABLE `quotations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_items`
--

DROP TABLE IF EXISTS `sale_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sale_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `saleId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `quantity` int NOT NULL,
  `unitPrice` decimal(15,2) NOT NULL,
  `discount` decimal(5,2) NOT NULL DEFAULT '0.00',
  `taxRate` decimal(5,2) NOT NULL,
  `totalPrice` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sale_items_saleId_fkey` (`saleId`),
  KEY `sale_items_productId_fkey` (`productId`),
  CONSTRAINT `sale_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sale_items_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_items`
--

LOCK TABLES `sale_items` WRITE;
/*!40000 ALTER TABLE `sale_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `sale_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales`
--

DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `saleNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `paymentStatus` enum('UNPAID','PARTIAL','PAID','OVERDUE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNPAID',
  `subTotal` decimal(15,2) NOT NULL,
  `discountAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `taxAmount` decimal(15,2) NOT NULL,
  `totalAmount` decimal(15,2) NOT NULL,
  `paidAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balanceAmount` decimal(15,2) NOT NULL,
  `saleDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expectedDelivery` datetime(3) DEFAULT NULL,
  `actualDelivery` datetime(3) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `invoiceUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quotationId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_saleNumber_key` (`saleNumber`),
  KEY `sales_customerId_fkey` (`customerId`),
  KEY `sales_createdById_fkey` (`createdById`),
  KEY `sales_quotationId_fkey` (`quotationId`),
  CONSTRAINT `sales_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sales_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sales_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `quotations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales`
--

LOCK TABLES `sales` WRITE;
/*!40000 ALTER TABLE `sales` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_targets`
--

DROP TABLE IF EXISTS `sales_targets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_targets` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employeeId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `periodType` enum('WEEKLY','MONTHLY','QUARTERLY','YEARLY') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MONTHLY',
  `periodYear` int NOT NULL,
  `periodNumber` int NOT NULL,
  `revenueTarget` decimal(15,2) NOT NULL,
  `leadsTarget` int NOT NULL DEFAULT '0',
  `quotationsTarget` int NOT NULL DEFAULT '0',
  `revenueAchieved` decimal(15,2) NOT NULL DEFAULT '0.00',
  `leadsAchieved` int NOT NULL DEFAULT '0',
  `quotationsSent` int NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `isRecurring` tinyint(1) NOT NULL DEFAULT '0',
  `reminderAt` datetime(3) DEFAULT NULL,
  `reminderSent` tinyint(1) NOT NULL DEFAULT '0',
  `parentTargetId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_targets_employeeId_periodType_periodYear_periodNumber_key` (`employeeId`,`periodType`,`periodYear`,`periodNumber`),
  KEY `sales_targets_createdById_fkey` (`createdById`),
  KEY `sales_targets_parentTargetId_fkey` (`parentTargetId`),
  CONSTRAINT `sales_targets_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sales_targets_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sales_targets_parentTargetId_fkey` FOREIGN KEY (`parentTargetId`) REFERENCES `sales_targets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_targets`
--

LOCK TABLES `sales_targets` WRITE;
/*!40000 ALTER TABLE `sales_targets` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_targets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'GENERAL',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settings_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_checklist_items`
--

DROP TABLE IF EXISTS `task_checklist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_checklist_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `taskId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isCompleted` tinyint(1) NOT NULL DEFAULT '0',
  `completedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `task_checklist_items_taskId_fkey` (`taskId`),
  CONSTRAINT `task_checklist_items_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_checklist_items`
--

LOCK TABLES `task_checklist_items` WRITE;
/*!40000 ALTER TABLE `task_checklist_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_checklist_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` enum('PERSONAL','TEAM') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PERSONAL',
  `priority` enum('LOW','MEDIUM','HIGH','URGENT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEDIUM',
  `status` enum('PENDING','IN_PROGRESS','COMPLETED','OVERDUE','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `startDate` datetime(3) DEFAULT NULL,
  `dueDate` datetime(3) NOT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  `isRecurring` tinyint(1) NOT NULL DEFAULT '0',
  `recurrence` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recurrenceEnd` datetime(3) DEFAULT NULL,
  `reminderAt` datetime(3) DEFAULT NULL,
  `reminderSent` tinyint(1) NOT NULL DEFAULT '0',
  `assignmentVoiceUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assignmentVoiceNote` text COLLATE utf8mb4_unicode_ci,
  `completionVoiceUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completionVoiceNote` text COLLATE utf8mb4_unicode_ci,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignedToId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `attachmentUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failureReason` text COLLATE utf8mb4_unicode_ci,
  `deletedAt` datetime(3) DEFAULT NULL,
  `isArchived` tinyint(1) NOT NULL DEFAULT '0',
  `snapshotManagerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tasks_createdById_fkey` (`createdById`),
  KEY `tasks_assignedToId_status_type_idx` (`assignedToId`,`status`,`type`),
  KEY `tasks_isArchived_assignedToId_idx` (`isArchived`,`assignedToId`),
  CONSTRAINT `tasks_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `tasks_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasks`
--

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_permission_audit_logs`
--

DROP TABLE IF EXISTS `user_permission_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_permission_audit_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `targetUserId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `changedById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `previousState` json DEFAULT NULL,
  `newState` json DEFAULT NULL,
  `timestamp` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `user_permission_audit_logs_targetUserId_idx` (`targetUserId`),
  KEY `user_permission_audit_logs_changedById_fkey` (`changedById`),
  CONSTRAINT `user_permission_audit_logs_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `user_permission_audit_logs_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_permission_audit_logs`
--

LOCK TABLES `user_permission_audit_logs` WRITE;
/*!40000 ALTER TABLE `user_permission_audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_permission_audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firstName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('ADMIN','EMPLOYEE','USER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `status` enum('ACTIVE','INACTIVE','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `avatar` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `delegatedManagerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delegationExpiresAt` datetime(3) DEFAULT NULL,
  `managerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `isSuperAdmin` tinyint(1) NOT NULL DEFAULT '0',
  `canAssignLeads` tinyint(1) NOT NULL DEFAULT '0',
  `canAssignTasks` tinyint(1) NOT NULL DEFAULT '0',
  `canViewSubordinates` tinyint(1) NOT NULL DEFAULT '0',
  `hierarchyPath` text COLLATE utf8mb4_unicode_ci,
  `canCreateMaterialRequests` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  KEY `users_managerId_fkey` (`managerId`),
  KEY `users_delegatedManagerId_fkey` (`delegatedManagerId`),
  CONSTRAINT `users_delegatedManagerId_fkey` FOREIGN KEY (`delegatedManagerId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `users_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('86253734-0bcd-4f31-ad25-cbe5388e6755','admin@kvbgreenenergies.com','$2b$10$sA2AgPhHarH5f47EZrm2K.n4oWJraPtxvzrcO.oC5yQZnHJ6ce8cm','Admin','KVB',NULL,'ADMIN','ACTIVE',NULL,'2026-05-14 05:33:45.233','2026-05-20 05:36:58.370','2026-05-26 11:10:22.427',NULL,NULL,NULL,NULL,1,0,0,0,NULL,0);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contactName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `city` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gstNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paymentTerms` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `pinCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `whatsapp_messages`
--

DROP TABLE IF EXISTS `whatsapp_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_messages` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `templateId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sentAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deliveredAt` datetime(3) DEFAULT NULL,
  `readAt` datetime(3) DEFAULT NULL,
  `leadId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `whatsapp_messages_leadId_fkey` (`leadId`),
  CONSTRAINT `whatsapp_messages_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `whatsapp_messages`
--

LOCK TABLES `whatsapp_messages` WRITE;
/*!40000 ALTER TABLE `whatsapp_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `whatsapp_messages` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-26 16:51:15
