# KVB Green Energies - Comprehensive CRM System Plan

## Executive Summary

This document outlines the complete technical architecture, database design, and implementation plan for a custom CRM system tailored for KVB Green Energies. The system will feature role-based access control (Admin, Employee/Sales, User), comprehensive sales and purchase management, lead tracking, task management, voice recording for task assignment and completion, bulk lead broadcasting via WhatsApp/Email/Facebook, and automated follow-up reminders via WhatsApp and Email.

---

## 1. System Architecture

### 1.1 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + Vite | Modern UI development |
| **Styling** | CSS + shadcn/ui | Consistent, responsive design system |
| **State Management** | Zustand + React Query | Efficient state and server cache management |
| **Backend** | Node.js + Express | RESTful API development |
| **Database** | MySQL 8.x | Relational data storage |
| **ORM** | Prisma (MySQL provider) | Database operations |
| **Authentication** | JWT + bcrypt | Secure user authentication |
| **File Storage** | Local | Documents, invoices, voice recordings stored on server |
| **PDF Generation** | Puppeteer + HTML templates | Invoice and quotation PDFs |
| **WhatsApp API** | Meta Business API | WhatsApp notifications & bulk messaging |
| **Email Service** | SendGrid / Nodemailer | Email notifications & bulk email campaigns |
| **Facebook API** | Meta Graph API | Facebook Messenger bulk messaging |
| **Scheduler** | node-cron | Automated reminders and follow-ups |
| **Voice Recording** | Browser MediaRecorder API + Local File Storage | Voice note capture and server-side storage |
| **Real-Time Layer** | Socket.IO (WebSockets) | Live in-app notifications for task assignments, lead updates, follow-up alerts |

### 1.2 Application Structure

```
KVB-Green-CRM/
├── frontend/                    # React Application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── VoiceRecorder/   # Voice recording widget (tasks, notes)
│   │   │   └── BulkMessage/     # Bulk lead messaging panel
│   │   ├── pages/               # Page components
│   │   ├── hooks/               # Custom React hooks
│   │   │   └── useVoiceRecorder.js  # Voice recording hook
│   │   ├── stores/              # Zustand state stores
│   │   ├── services/            # API service functions
│   │   ├── utils/               # Utility functions
│   │   └── constants/           # App constants
│   └── public/
├── backend/                     # Node.js API Server
│   ├── src/
│   │   ├── controllers/         # Route controllers
│   │   ├── routes/              # API routes
│   │   ├── middleware/          # Auth, validation middleware
│   │   ├── services/            # Business logic
│   │   │   ├── voiceStorage.service.js   # Voice file handling (local disk)
│   │   │   ├── bulkMessage.service.js    # Bulk WhatsApp/Email/Facebook
│   │   │   ├── socket.service.js         # Socket.IO event emitters (notifications)
│   │   ├── models/              # Database models (Prisma)
│   │   ├── utils/               # Helper functions
│   │   └── jobs/                # Cron jobs for reminders
│   ├── uploads/                 # Local file storage root
│   │   ├── voice/               # Voice recordings (tasks & notes)
│   │   ├── invoices/            # Generated invoice PDFs
│   │   └── quotations/          # Generated quotation PDFs
│   └── prisma/
│       └── schema.prisma        # Database schema (MySQL)
└── shared/                      # Shared constants
```

> **Local Storage Note:** All uploaded files (voice notes, PDFs, avatars) are stored in the `backend/uploads/` directory, served through a protected Express static route. Ensure the server has adequate disk space and that the `uploads/` directory is excluded from version control (`.gitignore`).

---

## 2. Database Schema Design

> **Database:** MySQL 8.x
> **ORM:** Prisma with `provider = "mysql"`
> All `Json` fields use MySQL's native `JSON` column type (supported in MySQL 8+).
> Use `@db.Text` for large string fields. Voice files are stored on local disk — only the server-relative file path is saved in the DB.

### 2.1 Prisma Datasource Configuration

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  // Example: DATABASE_URL="mysql://user:password@localhost:3306/kvb_crm"
}

generator client {
  provider = "prisma-client-js"
}
```

---

### 2.2 Core Entities

```prisma
// ============================================
// USER MANAGEMENT
// ============================================

enum UserRole {
  ADMIN
  EMPLOYEE
  USER
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

model User {
  id              String      @id @default(uuid())
  email           String      @unique
  password        String
  firstName       String
  lastName        String
  phone           String?
  role            UserRole    @default(USER)
  status          UserStatus  @default(ACTIVE)
  avatar          String?     // Local file path e.g. /uploads/avatars/filename.jpg
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  lastLoginAt     DateTime?

  // Relations
  leadsCreated    Lead[]      @relation("LeadCreator")
  leadsAssigned   Lead[]      @relation("LeadAssignee")
  tasksCreated    Task[]      @relation("TaskCreator")
  tasksAssigned   Task[]      @relation("TaskAssignee")
  sales           Sale[]
  quotations      Quotation[]
  followUps       FollowUp[]
  notes           Note[]
  dailyReports    DailyReport[]
  bulkMessages    BulkMessageCampaign[]
  salesTargets    SalesTarget[]
  targetsCreated  SalesTarget[]       @relation("TargetCreator")
  notifications   Notification[]

  @@map("users")
}

// ============================================
// CUSTOMER/CONTACT MANAGEMENT
// ============================================

model Customer {
  id              String    @id @default(uuid())
  companyName     String?
  contactName     String
  email           String?
  phone           String
  alternatePhone  String?
  address         String?   @db.Text
  city            String?
  state           String?
  pincode         String?
  country         String    @default("India")
  gstNumber       String?
  // Facebook Messenger PSID for bulk messaging
  facebookPsid    String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  leads           Lead[]
  sales           Sale[]
  quotations      Quotation[]

  @@map("customers")
}

// ============================================
// LEAD MANAGEMENT
// ============================================

enum LeadStatus {
  NEW
  INQUIRY
  FOLLOW_UP
  QUOTATION_SENT
  ORDER_CONFIRMED
  WON
  LOST
  UNQUALIFIED
}

enum LeadSource {
  FACEBOOK
  GOOGLE
  WHATSAPP
  JUSTDIAL
  FIELD_MARKETING
  REFERRAL
  WEBSITE
  WALK_IN
  OTHER
}

model Lead {
  id              String      @id @default(uuid())
  leadNumber      String      @unique  // L-XXXXX format
  title           String
  description     String?     @db.Text
  status          LeadStatus  @default(NEW)
  source          LeadSource  @default(OTHER)
  estimateAmount  Decimal?    @db.Decimal(15, 2)
  closeDate       DateTime?

  // Relations
  customerId      String
  customer        Customer    @relation(fields: [customerId], references: [id])

  createdById     String
  createdBy       User        @relation("LeadCreator", fields: [createdById], references: [id])

  assignedToId    String?
  assignedTo      User?       @relation("LeadAssignee", fields: [assignedToId], references: [id])

  products        LeadProduct[]
  followUps       FollowUp[]
  notes           Note[]
  emails          Email[]
  whatsappMsgs    WhatsAppMessage[]
  quotations      Quotation[]
  timeline        LeadTimeline[]
  bulkMessageLogs BulkMessageLog[]

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  // NOTE: On lead/customer creation the API checks for an existing Customer
  // record with the same phone or email. If a match is found, a 409 warning
  // is returned to the frontend so the user can confirm or merge instead of
  // creating a duplicate entry.

  @@map("leads")
}

model LeadProduct {
  id          String   @id @default(uuid())
  leadId      String
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  quantity    Int      @default(1)
  notes       String?  @db.Text

  @@map("lead_products")
}

model LeadTimeline {
  id          String   @id @default(uuid())
  leadId      String
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  action      String   // "Lead Created", "Status Changed", "Follow-up Added", "Bulk Message Sent", etc.
  description String?  @db.Text
  oldValue    String?
  newValue    String?
  performedBy String
  user        User     @relation(fields: [performedBy], references: [id])
  createdAt   DateTime @default(now())

  @@map("lead_timeline")
}

// ============================================
// FOLLOW-UP MANAGEMENT
// ============================================

enum FollowUpType {
  CALL
  WHATSAPP
  EMAIL
  MEETING
}

enum FollowUpStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  OVERDUE
}

model FollowUp {
  id              String          @id @default(uuid())
  type            FollowUpType
  description     String          @db.Text
  scheduledAt     DateTime
  completedAt     DateTime?
  status          FollowUpStatus  @default(SCHEDULED)
  outcome         String?         @db.Text

  leadId          String
  lead            Lead            @relation(fields: [leadId], references: [id], onDelete: Cascade)

  assignedToId    String
  assignedTo      User            @relation(fields: [assignedToId], references: [id])

  reminders       FollowUpReminder[]

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@map("follow_ups")
}

model FollowUpReminder {
  id              String   @id @default(uuid())
  followUpId      String
  followUp        FollowUp @relation(fields: [followUpId], references: [id], onDelete: Cascade)

  reminderVia     String   // "MOBILE_APP", "WHATSAPP", "EMAIL"
  remindBefore    Boolean  @default(true)
  reminderTime    Int
  reminderUnit    String   // "MINUTES", "HOURS", "DAYS"

  isSent          Boolean  @default(false)
  sentAt          DateTime?

  @@map("follow_up_reminders")
}

// ============================================
// NOTES & COMMUNICATION
// ============================================

model Note {
  id          String    @id @default(uuid())
  content     String    @db.Text
  isVoiceNote Boolean   @default(false)
  voiceUrl    String?   // Local file path e.g. /uploads/voice/notes/filename.webm

  leadId      String
  lead        Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)

  createdById String
  createdBy   User      @relation(fields: [createdById], references: [id])

  createdAt   DateTime  @default(now())

  @@map("notes")
}

model Email {
  id          String   @id @default(uuid())
  subject     String
  body        String   @db.Text
  to          String
  from        String
  sentAt      DateTime @default(now())

  leadId      String
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@map("emails")
}

model WhatsAppMessage {
  id          String   @id @default(uuid())
  message     String   @db.Text
  templateId  String?
  sentAt      DateTime @default(now())
  deliveredAt DateTime?
  readAt      DateTime?

  leadId      String
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@map("whatsapp_messages")
}

// ============================================
// BULK LEAD MESSAGING
// ============================================
// Allows owner/admin to select all or filtered leads
// and send a single automated message via
// WhatsApp, Email, or Facebook Messenger in one click.

enum BulkMessageChannel {
  WHATSAPP
  EMAIL
  FACEBOOK
}

enum BulkMessageStatus {
  DRAFT
  SENDING
  COMPLETED
  FAILED
  PARTIAL
}

model BulkMessageCampaign {
  id              String              @id @default(uuid())
  campaignName    String
  channel         BulkMessageChannel
  messageTemplate String              @db.Text  // Template body
  subject         String?             // For email campaigns
  status          BulkMessageStatus   @default(DRAFT)
  totalLeads      Int                 @default(0)
  sentCount       Int                 @default(0)
  failedCount     Int                 @default(0)
  scheduledAt     DateTime?           // Optional: schedule for later
  sentAt          DateTime?

  // Filters used to select leads for this campaign
  filterStatus    String?   // LeadStatus filter applied
  filterSource    String?   // LeadSource filter applied
  filterAssignee  String?   // Assignee filter

  createdById     String
  createdBy       User                @relation(fields: [createdById], references: [id])

  logs            BulkMessageLog[]

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@map("bulk_message_campaigns")
}

model BulkMessageLog {
  id          String              @id @default(uuid())
  campaignId  String
  campaign    BulkMessageCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  leadId      String
  lead        Lead                @relation(fields: [leadId], references: [id])

  channel     BulkMessageChannel
  recipient   String              // phone / email / facebook PSID
  status      String              // "SENT", "DELIVERED", "FAILED", "BOUNCED"
  errorMsg    String?
  sentAt      DateTime            @default(now())

  @@map("bulk_message_logs")
}

// ============================================
// PRODUCT MANAGEMENT
// ============================================
// Products have a base description but it is
// OVERRIDABLE at the quotation/sale line-item level
// to accommodate custom requirements per customer.

model Product {
  id              String          @id @default(uuid())
  name            String
  description     String?         @db.Text  // Default/base description (editable in settings)
  sku             String?         @unique
  category        String?
  unitOfMeasure   String          @default("Units")
  basePrice       Decimal         @db.Decimal(15, 2)
  taxRate         Decimal         @default(18.00) @db.Decimal(5, 2)
  isActive        Boolean         @default(true)

  leadProducts    LeadProduct[]
  quotationItems  QuotationItem[]
  saleItems       SaleItem[]

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@map("products")
}

// ============================================
// QUOTATION MANAGEMENT
// ============================================

enum QuotationStatus {
  DRAFT
  SENT
  APPROVED
  REJECTED
  CONVERTED_TO_SALE
  EXPIRED
}

model Quotation {
  id              String          @id @default(uuid())
  quotationNumber String          @unique
  version         Int             @default(1)
  status          QuotationStatus @default(DRAFT)

  subTotal        Decimal         @db.Decimal(15, 2)
  discountAmount  Decimal         @default(0) @db.Decimal(15, 2)
  discountPercent Decimal         @default(0) @db.Decimal(5, 2)
  taxAmount       Decimal         @db.Decimal(15, 2)
  totalAmount     Decimal         @db.Decimal(15, 2)

  quotationDate   DateTime        @default(now())
  validUntil      DateTime?

  paymentTerms    String?
  deliveryTerms   String?
  notes           String?         @db.Text
  termsConditions String?         @db.Text

  pdfUrl          String?         // Local file path e.g. /uploads/quotations/Q-XXXXX.pdf

  leadId          String
  lead            Lead            @relation(fields: [leadId], references: [id])

  customerId      String
  customer        Customer        @relation(fields: [customerId], references: [id])

  createdById     String
  createdBy       User            @relation(fields: [createdById], references: [id])

  items           QuotationItem[]

  saleId          String?
  sale            Sale?           @relation(fields: [saleId], references: [id])

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@map("quotations")
}

model QuotationItem {
  id          String    @id @default(uuid())
  quotationId String
  quotation   Quotation @relation(fields: [quotationId], references: [id], onDelete: Cascade)

  productId   String
  product     Product   @relation(fields: [productId], references: [id])

  // Customer-specific overridable description.
  // Populated from product.description by default;
  // user can freely edit it to match customer requirements.
  description String?   @db.Text

  quantity    Int
  unitPrice   Decimal   @db.Decimal(15, 2)
  discount    Decimal   @default(0) @db.Decimal(5, 2)
  taxRate     Decimal   @db.Decimal(5, 2)
  totalPrice  Decimal   @db.Decimal(15, 2)

  @@map("quotation_items")
}

// ============================================
// SALES MANAGEMENT
// ============================================

enum SaleStatus {
  PENDING
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  UNPAID
  PARTIAL
  PAID
  OVERDUE
}

model Sale {
  id              String          @id @default(uuid())
  saleNumber      String          @unique
  status          SaleStatus      @default(PENDING)
  paymentStatus   PaymentStatus   @default(UNPAID)

  subTotal        Decimal         @db.Decimal(15, 2)
  discountAmount  Decimal         @default(0) @db.Decimal(15, 2)
  taxAmount       Decimal         @db.Decimal(15, 2)
  totalAmount     Decimal         @db.Decimal(15, 2)
  paidAmount      Decimal         @default(0) @db.Decimal(15, 2)
  balanceAmount   Decimal         @db.Decimal(15, 2)

  saleDate        DateTime        @default(now())
  expectedDelivery DateTime?
  actualDelivery  DateTime?

  notes           String?         @db.Text
  invoiceUrl      String?         // Local file path e.g. /uploads/invoices/INV-XXXXX.pdf

  customerId      String
  customer        Customer        @relation(fields: [customerId], references: [id])

  createdById     String
  createdBy       User            @relation(fields: [createdById], references: [id])

  items           SaleItem[]
  payments        Payment[]

  quotationId     String?
  quotation       Quotation?      @relation(fields: [quotationId], references: [id])

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@map("sales")
}

model SaleItem {
  id          String   @id @default(uuid())
  saleId      String
  sale        Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)

  productId   String
  product     Product  @relation(fields: [productId], references: [id])

  // Customer-specific overridable description (same as QuotationItem)
  description String?  @db.Text

  quantity    Int
  unitPrice   Decimal  @db.Decimal(15, 2)
  discount    Decimal  @default(0) @db.Decimal(5, 2)
  taxRate     Decimal  @db.Decimal(5, 2)
  totalPrice  Decimal  @db.Decimal(15, 2)

  @@map("sale_items")
}

model Payment {
  id              String   @id @default(uuid())
  amount          Decimal  @db.Decimal(15, 2)
  paymentMethod   String
  paymentDate     DateTime @default(now())
  referenceNumber String?
  notes           String?
  receiptUrl      String?  // Local file path e.g. /uploads/receipts/RCP-XXXXX.pdf — auto-generated on payment save

  saleId          String
  sale            Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)

  createdAt       DateTime @default(now())

  @@map("payments")
}

// ============================================
// PURCHASE MANAGEMENT
// ============================================

model Vendor {
  id              String          @id @default(uuid())
  companyName     String
  contactName     String
  email           String?
  phone           String
  address         String?         @db.Text
  city            String?
  state           String?
  gstNumber       String?
  paymentTerms    String?
  isActive        Boolean         @default(true)

  purchaseOrders  PurchaseOrder[]

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@map("vendors")
}

enum PurchaseOrderStatus {
  DRAFT
  SENT
  CONFIRMED
  RECEIVED
  CANCELLED
}

model PurchaseOrder {
  id              String              @id @default(uuid())
  poNumber        String              @unique
  status          PurchaseOrderStatus @default(DRAFT)

  subTotal        Decimal             @db.Decimal(15, 2)
  taxAmount       Decimal             @db.Decimal(15, 2)
  totalAmount     Decimal             @db.Decimal(15, 2)

  orderDate       DateTime            @default(now())
  expectedDate    DateTime?
  receivedDate    DateTime?

  notes           String?             @db.Text
  pdfUrl          String?             // Local file path e.g. /uploads/quotations/PO-XXXXX.pdf

  vendorId        String
  vendor          Vendor              @relation(fields: [vendorId], references: [id])

  createdById     String
  createdBy       User                @relation(fields: [createdById], references: [id])

  items           PurchaseOrderItem[]

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id              String        @id @default(uuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)

  itemName        String
  description     String?       @db.Text
  quantity        Int
  unitPrice       Decimal       @db.Decimal(15, 2)
  totalPrice      Decimal       @db.Decimal(15, 2)

  @@map("purchase_order_items")
}

// ============================================
// TASK / TO-DO MANAGEMENT  (WITH VOICE NOTES)
// ============================================
// Both the task assigner (owner) and the assigned
// worker can record a voice message:
//   - assignmentVoiceUrl  → recorded when assigning
//   - completionVoiceUrl  → recorded when marking done
// Voice files are stored on local server disk under
// backend/uploads/voice/tasks/

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  OVERDUE
  CANCELLED
}

enum TaskType {
  PERSONAL
  TEAM
}

model Task {
  id              String       @id @default(uuid())
  title           String
  description     String?      @db.Text
  type            TaskType     @default(PERSONAL)
  priority        TaskPriority @default(MEDIUM)
  status          TaskStatus   @default(PENDING)

  // Dates
  startDate       DateTime?
  dueDate         DateTime
  completedAt     DateTime?

  // Recurring
  isRecurring     Boolean      @default(false)
  recurrence      String?      // "DAILY", "WEEKLY", "MONTHLY"
  recurrenceEnd   DateTime?

  // Reminders
  reminderAt      DateTime?
  reminderSent    Boolean      @default(false)

  // --- VOICE RECORDING ---
  // Voice note recorded by the owner/assigner at time of task creation
  assignmentVoiceUrl  String?   // Local path e.g. /uploads/voice/tasks/{id}/assign.webm
  assignmentVoiceNote String?   @db.Text  // Optional text transcript

  // Voice note recorded by the worker upon task completion
  completionVoiceUrl  String?   // Local path e.g. /uploads/voice/tasks/{id}/complete.webm
  completionVoiceNote String?   @db.Text  // Optional text transcript
  // -----------------------

  // Relations
  createdById     String
  createdBy       User         @relation("TaskCreator", fields: [createdById], references: [id])

  assignedToId    String
  assignedTo      User         @relation("TaskAssignee", fields: [assignedToId], references: [id])

  checklist       TaskChecklistItem[]

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@map("tasks")
}

model TaskChecklistItem {
  id          String   @id @default(uuid())
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  content     String
  isCompleted Boolean  @default(false)
  completedAt DateTime?

  @@map("task_checklist_items")
}

// ============================================
// DAILY REPORTS
// ============================================

model DailyReport {
  id              String   @id @default(uuid())
  reportDate      DateTime

  leadsCreated    Int      @default(0)
  leadsContacted  Int      @default(0)
  followUpsDone   Int      @default(0)
  quotationsSent  Int      @default(0)
  salesClosed     Int      @default(0)
  revenue         Decimal  @default(0) @db.Decimal(15, 2)

  activities      String?  @db.Text
  challenges      String?  @db.Text
  nextDayPlan     String?  @db.Text

  employeeId      String
  employee        User     @relation(fields: [employeeId], references: [id])

  createdAt       DateTime @default(now())

  @@unique([employeeId, reportDate])
  @@map("daily_reports")
}

// ============================================
// EMPLOYEE SALES TARGETS
// ============================================
// Admin sets monthly or quarterly revenue/lead targets
// per employee. Attainment is computed from Sale + Lead data.

enum TargetPeriodType {
  MONTHLY
  QUARTERLY
}

model SalesTarget {
  id              String           @id @default(uuid())
  employeeId      String
  employee        User             @relation(fields: [employeeId], references: [id])

  periodType      TargetPeriodType @default(MONTHLY)
  periodYear      Int              // e.g. 2026
  periodNumber    Int              // Month (1-12) or Quarter (1-4)

  revenueTarget   Decimal          @db.Decimal(15, 2)   // Target revenue in INR
  leadsTarget     Int              @default(0)           // Target leads to close
  quotationsTarget Int             @default(0)           // Target quotations to send

  // Attainment — computed and cached; refreshed by cron or on data change
  revenueAchieved Decimal          @default(0) @db.Decimal(15, 2)
  leadsAchieved   Int              @default(0)
  quotationsSent  Int              @default(0)

  notes           String?          @db.Text
  createdById     String
  createdBy       User             @relation("TargetCreator", fields: [createdById], references: [id])

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@unique([employeeId, periodType, periodYear, periodNumber])
  @@map("sales_targets")
}

// ============================================
// IN-APP NOTIFICATIONS (Real-Time via Socket.IO)
// ============================================
// Persisted so users can review missed notifications.
// Socket.IO pushes live events; this table acts as
// a fallback store for unread/historical notifications.

enum NotificationType {
  TASK_ASSIGNED
  TASK_COMPLETED
  LEAD_STATUS_CHANGED
  LEAD_ASSIGNED
  FOLLOW_UP_DUE
  PAYMENT_RECEIVED
  QUOTATION_APPROVED
  BULK_MESSAGE_DONE
  TARGET_MILESTONE      // e.g. reached 50% / 100% of monthly target
}

model Notification {
  id          String           @id @default(uuid())
  userId      String           // Recipient
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  type        NotificationType
  title       String
  body        String           @db.Text

  entityType  String?          // "lead" | "task" | "sale" | "payment" etc.
  entityId    String?          // UUID of the related record for deep-linking

  isRead      Boolean          @default(false)
  readAt      DateTime?

  createdAt   DateTime         @default(now())

  @@index([userId, isRead])
  @@map("notifications")
}

// ============================================
// SYSTEM SETTINGS
// ============================================

model Setting {
  id          String   @id @default(uuid())
  key         String   @unique
  value       String   @db.Text
  description String?

  @@map("settings")
}

model ActivityLog {
  id          String   @id @default(uuid())
  userId      String?
  action      String
  entityType  String
  entityId    String?
  oldData     Json?
  newData     Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@map("activity_logs")
}
```

---

## 3. User Roles & Permissions Matrix

### 3.1 Role Definitions

| Role | Description |
|------|-------------|
| **Admin** | Full system access. Can manage users, view all data, configure settings, access all reports, and send bulk messages to all leads. |
| **Employee (Sales)** | Manages assigned leads, creates quotations and sales, manages follow-ups, submits daily reports, records voice notes on tasks. |
| **User** | Limited access — can view own profile, track order status, view invoices (customer portal). |

### 3.2 Permission Matrix

| Feature | Admin | Employee | User |
|---------|-------|----------|------|
| **Dashboard** | Full | Own Data Only | Own Data Only |
| **User Management** | CRUD | View Only | - |
| **Lead Management** | CRUD All | CRUD Assigned | - |
| **Bulk Lead Messaging** | Full (All Leads) | Own Leads Only | - |
| **Quotation** | CRUD All | CRUD Own | View Own |
| **Product Description Edit (Line Item)** | Yes | Yes | No |
| **Sales** | CRUD All | CRUD Own | View Own |
| **Purchase Orders** | CRUD All | View Only | - |
| **Vendor Management** | CRUD | View Only | - |
| **Product Management** | CRUD | View Only | - |
| **Tasks** | CRUD All | CRUD Own | - |
| **Task Voice Recording** | Assign + Complete | Complete Only | - |
| **Daily Reports** | View All | CRUD Own | - |
| **Reports & Analytics** | Full Access | Limited | - |
| **Employee Sales Targets** | CRUD All | View Own | - |
| **Employee Performance Scorecard** | View All | View Own | - |
| **Export to Excel/CSV** | All Modules | Own Data | - |
| **Real-Time Notifications** | Receive All | Receive Own | - |
| **Settings** | Full Access | - | - |
| **Follow-ups** | CRUD All | CRUD Own | - |
| **WhatsApp/Email** | Send All | Send Own Leads | - |
| **Facebook Messaging** | Send All | Send Own Leads | - |

---

## 4. Module Specifications

### 4.1 SALES MODULE

#### Features:
1. **Create Sale**
   - Convert quotation to sale with one click
   - Manual sale creation with customer selection
   - Product line items with quantity, price, discount
   - **Each line item's description is independently editable** to reflect customer-specific customizations, scope changes, or non-standard configurations — overrides the product's default description without altering the master product record
   - Auto-calculation of taxes and totals
   - Payment terms and delivery date

2. **Generate Invoice**
   - Auto-generate professional PDF invoice saved to local server (`/uploads/invoices/`)
   - Customizable invoice template with KVB branding
   - GST-compliant invoice format
   - Download and share options
   - Invoice numbering: INV-XXXXX

3. **Payment Status Tracking**
   - Record partial and full payments
   - Payment method tracking (Cash, UPI, Bank Transfer, Cheque)
   - Balance amount calculation
   - Payment history per sale
   - Overdue payment alerts
   - **Auto-generate Payment Receipt PDF** — on every payment save, Puppeteer generates a branded receipt saved to `/uploads/receipts/RCP-XXXXX.pdf`; path stored in `payment.receiptUrl`. Receipt is downloadable from the payment history row and can be shared via WhatsApp/Email directly.

#### Database Tables: `Sale`, `SaleItem`, `Payment`

---

### 4.2 PURCHASE MODULE

#### Features:
1. **Vendor Management** — add/edit vendor details, contact info, GST, payment terms, vendor performance, purchase history
2. **Purchase Order** — create PO with vendor selection, line items, status tracking (Draft → Sent → Confirmed → Received), auto-generate PDF PO, PO numbering: PO-XXXXX
3. **Track Incomes/Materials/Services** — categorize purchases, track expected vs actual delivery, purchase cost analysis, vendor-wise spending reports

#### Database Tables: `Vendor`, `PurchaseOrder`, `PurchaseOrderItem`

---

### 4.3 QUOTATION MODULE

#### Features:
1. **Create Quotation**
   - Select lead/customer
   - Add multiple products with quantities
   - **Per-line-item description field** — auto-filled from the product's default description but fully editable to match the customer's specific requirements (e.g., custom wattage, non-standard installation scope, bespoke configurations). Changes are saved at the quotation level and do NOT modify the master product catalogue.
   - Apply discounts (item-wise or overall)
   - Auto tax calculation (GST)
   - Terms and conditions section
   - Validity date setting
   - Notes section

2. **Convert Quotation to Sales Order**
   - One-click conversion
   - Preserve all quotation details including edited line-item descriptions
   - Track conversion rate
   - Version control for revisions

3. **Share PDF with Customer**
   - PDF generated and saved locally (`/uploads/quotations/`)
   - Download option
   - Email directly from system
   - WhatsApp sharing integration
   - Track if customer viewed

#### Database Tables: `Quotation`, `QuotationItem`

---

### 4.4 DAILY REPORT MODULE

#### Features:
1. **Employee Summary** — daily activity summary, leads created/contacted/converted, follow-ups, quotations, sales closed
2. **Daily Report Submission** — form for activities, challenges faced, next day plan
3. **Performance Tracking** — individual employee dashboard, weekly/monthly charts, target vs achievement, leaderboard

#### Database Tables: `DailyReport`

---

### 4.5 TO-DO LIST MODULE (WITH VOICE RECORDING)

#### Features:
1. **Set Reminder**
   - Date and time picker
   - Recurring task option (Daily, Weekly, Monthly)
   - Priority levels (Low, Medium, High, Urgent)
   - Notification via app/email/WhatsApp

2. **Voice Recording for Task Assignment**
   - When creating or assigning a task, the owner taps the 🎤 microphone button to record a voice message explaining the task context, special instructions, or expectations
   - Recording is saved to local server disk at `/uploads/voice/tasks/{taskId}/assign.webm`
   - The server-relative path is stored in `task.assignmentVoiceUrl`
   - The assigned worker sees a play button on the task card and can listen to the assignment voice note before starting
   - Optional auto-transcript displayed alongside the audio player

3. **Mark as Complete with Voice Note**
   - When the worker marks a task as completed, they can optionally record a voice note describing what was done, issues faced, or confirmation details
   - Recording is saved to local server disk at `/uploads/voice/tasks/{taskId}/complete.webm`
   - The server-relative path is stored in `task.completionVoiceUrl`
   - Admin/owner receives a notification with the completion voice note and can play it from the task detail view
   - Optional auto-transcript displayed alongside the completion audio

4. **Personal and Team Tasks**
   - Personal task list per user
   - Assign tasks to team members
   - Task categories/tags
   - Checklist/subtasks support
   - Task templates

#### Database Tables: `Task`, `TaskChecklistItem`

---

### 4.6 LEAD MANAGEMENT MODULE

#### Features:
1. **Task Timeline** — visual timeline of all lead activities: status changes, follow-ups, notes, emails/WhatsApp, quotation history, bulk messages sent
2. **Lead Details & Customer Details** — complete lead info, customer profile, contact history, custom fields, source tracking
3. **Notes** — text notes, voice notes (audio recording saved locally), file attachments, timestamp and author
4. **Follow-ups** — schedule (Call, WhatsApp, Email, Meeting), set reminders, track completion
5. **Emails** — send emails from system, templates, track history
6. **Products** — associate products with lead
7. **WhatsApp Integration** — send messages via Meta Business API, template messages, track delivery
8. **Total Leads Dashboard** — Kanban board view, list view, filter, search, bulk actions, lead source analytics

9. **Bulk Lead Messaging**
   - Owner/Admin can **select all leads** (or filter by status, source, or assignee) with a single checkbox
   - Choose broadcast channel: **WhatsApp**, **Email**, or **Facebook Messenger**
   - Compose message or select a saved template
   - Preview before sending
   - System sends automated messages to all selected leads using Meta Business API (WhatsApp/Facebook) or SendGrid/Nodemailer (Email)
   - All sends are logged per lead in `BulkMessageLog` and a summary entry added to the lead timeline
   - Campaign status tracked in `BulkMessageCampaign` (Sending → Completed / Partial)
   - Failure reasons captured and retryable

#### Database Tables: `Lead`, `LeadProduct`, `LeadTimeline`, `FollowUp`, `Note`, `Email`, `WhatsAppMessage`, `BulkMessageCampaign`, `BulkMessageLog`

---

### 4.7 FOLLOW-UP REMINDERS

#### Features:
1. **Schedule Follow-up Reminders** — select channel (Mobile App, WhatsApp, Email), set timing (before/after), configure in minutes/hours/days, multiple reminders per follow-up
2. **Reminder Execution** — automated cron job checks every minute, sends via selected channels, tracks delivery, escalation for overdue follow-ups

#### Database Tables: `FollowUp`, `FollowUpReminder`

---

### 4.8 EMPLOYEE SALES TARGETS MODULE

#### Overview
Admin sets revenue, lead-close, and quotation targets per employee on a monthly or quarterly basis. The system automatically tracks attainment by querying `Sale` (for revenue) and `Lead` (for closed count) data, and updates the `SalesTarget` record via a nightly cron job. Employees can see their own progress; admins see all employees.

#### How It Integrates With Other Modules
- **Sale Module** → every confirmed sale increments `revenueAchieved` on the active target for the sale's `createdById` employee for the current period.
- **Lead Module** → every lead moved to `WON` status increments `leadsAchieved` on the corresponding employee's active target.
- **Quotation Module** → every quotation sent increments `quotationsSent` on the active target.
- **Daily Report Module** → the employee dashboard pulls the current period's `SalesTarget` record to render the target progress bar alongside their daily report.
- **Notification System** → when an employee hits 50% or 100% of their revenue target, a `TARGET_MILESTONE` notification is auto-fired via Socket.IO and stored in the `Notification` table.
- **Performance Scorecard** → target attainment % is one of the five computed KPIs on the scorecard (see §4.10).

#### Features
1. **Set Targets (Admin)** — monthly or quarterly target per employee covering: revenue (₹), leads to close, quotations to send
2. **Target Progress Dashboard** — donut/radial chart showing % attained for each KPI, with actual vs target numbers
3. **Period Comparison** — compare current month vs last month vs same month last year
4. **Leaderboard** — ranked table of all employees by revenue attainment % for the current period

#### Database Tables: `SalesTarget`

---

### 4.9 REAL-TIME NOTIFICATIONS (Socket.IO)

#### Overview
A Socket.IO server runs alongside the Express HTTP server on the same Node.js process. On login, the frontend opens a persistent WebSocket connection authenticated with the user's JWT. The backend emits targeted room-based events (one room per `userId`), so notifications are delivered only to the intended recipient without broadcasting to all connected clients.

#### How It Integrates With Other Modules
- **Task Module** → `TASK_ASSIGNED`: emitted to the assignee's room the moment a task is created/assigned. `TASK_COMPLETED`: emitted to the task creator's room when a worker marks complete with an optional voice note link.
- **Lead Module** → `LEAD_STATUS_CHANGED` / `LEAD_ASSIGNED`: emitted to the assignee and admin rooms when a lead's status or assignee changes.
- **Follow-Up Module** → `FOLLOW_UP_DUE`: emitted 10 minutes before the scheduled follow-up time (the existing `node-cron` job fires the Socket.IO event in addition to WhatsApp/Email reminders).
- **Sale & Payment Module** → `PAYMENT_RECEIVED`: emitted to the sale's owner and admin when a payment is recorded, including the receipt PDF link.
- **Bulk Messaging Module** → `BULK_MESSAGE_DONE`: emitted to the campaign creator when all sends complete (or partially complete).
- **Sales Target Module** → `TARGET_MILESTONE`: emitted to the employee when their attainment crosses 50% or 100%.

#### Persistence
Every emitted notification is simultaneously written to the `Notification` table so users who were offline (e.g., mobile browser closed) can retrieve missed alerts via the bell icon on next login. The `GET /api/notifications` endpoint returns unread notifications sorted by `createdAt DESC`.

#### Features
1. **Notification Bell** — header icon with unread badge count; clicking opens a slide-over panel listing recent notifications with timestamps and deep-links to the related entity
2. **Mark as Read** — individual or "mark all as read" action updates `isRead` and `readAt`
3. **Real-Time Push** — new notifications slide in as toast messages (top-right corner) without page refresh

#### Database Tables: `Notification`

---

### 4.10 EMPLOYEE PERFORMANCE SCORECARD

#### Overview
A computed, read-only report generated on demand that aggregates data across five modules into a single per-employee scorecard. Admins can view any employee's scorecard; employees can only view their own.

#### How It Integrates With Other Modules
- **Lead Module** → counts leads assigned vs leads in `WON`/`LOST` status to compute `Lead Conversion Rate %`.
- **Follow-Up Module** → calculates `Average Follow-Up Response Time` (time between `scheduledAt` and `completedAt` for completed follow-ups).
- **Task Module** → calculates `On-Time Task Completion Rate %` (tasks completed before `dueDate` / total completed tasks).
- **Sale Module** → sums `totalAmount` of confirmed sales to compute `Revenue Generated` for the selected period.
- **Sales Target Module** → pulls `revenueTarget` to show `Target Attainment %` alongside actual revenue.

#### Scorecard KPIs (per selected period)
| KPI | Source | Formula |
|-----|--------|---------|
| Lead Conversion Rate | Leads | WON leads ÷ Total assigned leads × 100 |
| Avg. Follow-Up Response Time | Follow-Ups | Mean of (completedAt − scheduledAt) for COMPLETED follow-ups |
| On-Time Task Completion | Tasks | Tasks completed ≤ dueDate ÷ total completed × 100 |
| Revenue Generated | Sales | Sum of sale.totalAmount where createdById = employee |
| Target Attainment | SalesTarget | revenueAchieved ÷ revenueTarget × 100 |

#### Features
1. **Period Selector** — view scorecard for any month or quarter
2. **Trend Arrows** — compare each KPI vs previous period (↑↓ with % delta)
3. **Leaderboard Tab** — rank all employees on a composite score for the selected period
4. **Export** — export individual scorecard as PDF or CSV

#### API Endpoint: `GET /api/reports/scorecard/:userId?period=2026-04`

---

### 4.11 LEAD DEDUPLICATION CHECK

#### Overview
Whenever a new `Lead` or `Customer` is created (or a phone/email field is updated), the backend runs a lightweight uniqueness check against the `customers` table before committing the record. This prevents the same customer appearing multiple times in the pipeline with separate, disconnected lead histories.

#### How It Integrates With Other Modules
- **Lead Creation** → `POST /api/leads` triggers a pre-save check. If a customer with the same `phone` OR `email` already exists, the API returns HTTP `409 Conflict` with the existing customer's ID and name.
- **Customer Creation** → `POST /api/customers` performs the same check.
- **Frontend UX** → on 409, the lead creation form shows a warning banner: *"A customer with this phone/email already exists: [Name]. Do you want to link this lead to the existing customer instead?"* with options **[Use Existing]** or **[Create Anyway]**.
- **Activity Log** → if the user proceeds with a duplicate (`Create Anyway`), an `ActivityLog` entry is written with `action: "DUPLICATE_CUSTOMER_OVERRIDE"` for admin review.

#### Features
1. **Real-Time Check** — phone and email fields trigger a debounced API check (`GET /api/customers/check-duplicate?phone=&email=`) on blur, showing a warning inline before the form is submitted
2. **Merge Suggestion** — if duplicates are discovered post-creation, an admin can merge two customer records (transfers all linked leads, quotations, and sales to the surviving record)
3. **Duplicate Report** — admin report listing all suspected duplicate customers based on fuzzy phone/name matching

#### Database Tables: Uses existing `Customer` table; adds index `@@index([phone, email])` for fast lookup

---

### 4.12 EXPORT TO EXCEL / CSV

#### Overview
All major list views expose a download button that streams data as `.xlsx` (via `exceljs`) or `.csv` directly from the backend without saving a file to disk. The export respects the same filters active in the current list view.

#### How It Integrates With Other Modules
- **Lead Module** → exports lead list with status, source, assigned employee, estimated amount, last follow-up date
- **Sales Module** → exports sales with customer name, items summary, total amount, payment status, balance
- **Payment Module** → exports payment history across all sales with receipt PDF links
- **Customer Module** → exports customer directory with contact details and linked lead/sale counts
- **Daily Reports Module** → exports all employee daily reports for a date range (useful for HR reviews)
- **Sales Target / Scorecard** → exports KPI table for all employees for a selected period

#### Features
1. **Format Toggle** — choose Excel (`.xlsx`) or CSV before downloading
2. **Filter-Aware** — export only the currently filtered/searched subset, not the entire table
3. **Column Selection** — user can check/uncheck which columns to include in the export
4. **Scheduled Export** (future) — email a scheduled export every Monday morning to admin

#### API Endpoints
```
GET /api/leads/export?format=xlsx&status=WON&from=2026-01-01
GET /api/sales/export?format=csv&from=2026-01-01
GET /api/payments/export?format=xlsx&saleId=optional
GET /api/customers/export?format=csv
GET /api/reports/daily/export?format=xlsx&employeeId=optional&from=2026-04-01
GET /api/reports/scorecard/export?format=xlsx&period=2026-04
```

#### Database Tables: No new tables. Queries existing `Lead`, `Sale`, `Payment`, `Customer`, `DailyReport`, `SalesTarget`

---

### 5.1 AUTHENTICATION PAGES

#### Login Page
- Email and password fields
- "Remember me" option
- Forgot password link
- Company logo and branding

#### Forgot Password Page
- Email input
- Send reset link button
- Back to login link

---

### 5.2 DASHBOARD PAGES

#### Admin Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  KVB GREEN ENERGIES - ADMIN DASHBOARD                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  TOTAL   │ │  OPEN    │ │   WON    │ │   LOST   │       │
│  │  Leads   │ │  Leads   │ │  Leads   │ │  Leads   │       │
│  │  2,044   │ │  1,264   │ │   188    │ │   592    │       │
│  │ ₹12.68Cr │ │ ₹8.62Cr  │ │ ₹56.53L  │ │ ₹3.49Cr  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  SALES REPORTS   │  │   DAILY LEADS    │                │
│  │   (Line Chart)   │  │   (Area Chart)   │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ SOURCE WISE LEADS│  │ SALES PERSON VS  │                │
│  │   (Bar Chart)    │  │   WON AMOUNT     │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

**Widgets:**
- KPI Cards: Total Leads, Open Leads, Won Leads, Lost Leads with amounts
- Sales Reports Chart (Line/Bar)
- Daily Leads Chart (Area)
- Source-wise Leads (Pie/Bar)
- Sales Person Performance (Horizontal Bar)
- Recent Activities Feed
- Upcoming Follow-ups
- Overdue Tasks Alert

#### Employee Dashboard
- Personal performance metrics, assigned leads summary, today's tasks and follow-ups, monthly target progress, recent quotations and sales

---

### 5.3 LEAD MANAGEMENT PAGES

#### Leads List Page (Kanban View)
```
┌─────────────────────────────────────────────────────────────────────────┐
│  LEADS - KANBAN VIEW                                                    │
│  [+ New Lead] [Filter] [Search] [List View Toggle]                      │
│  [☑ Select All] [📣 Broadcast Message ▼ WhatsApp | Email | Facebook]   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ NEW/INQUIRY  │ │FOLLOW-UP     │ │QUOTATION     │ │ORDER         │   │
│  │   5 leads    │ │   0 leads    │ │   1 leads    │ │CONFIRMED     │   │
│  │   ₹0/-       │ │   ₹0/-       │ │   ₹0/-       │ │   0 leads    │   │
│  ├──────────────┤ ├──────────────┤ ├──────────────┤ ├──────────────┤   │
│  │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │   │
│  │ │☑ Ravi-   │ │ │ │          │ │ │ │☑ Muneer  │ │ │ │          │ │   │
│  │ │chennai   │ │ │ │  No      │ │ │ │          │ │ │ │   No     │ │   │
│  │ │L-17062   │ │ │ │  Leads   │ │ │ │L-17035   │ │ │ │  Leads   │ │   │
│  │ │Apr 3     │ │ │ │  Found   │ │ │ │Mar 25    │ │ │ │  Found   │ │   │
│  │ │Amount: 0 │ │ │ │          │ │ │ │Amount: 0 │ │ │ │          │ │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Drag-and-drop lead cards between stages
- **Checkbox on each lead card** — select individual or all leads
- **[☑ Select All] button** — selects every visible/filtered lead in one click
- **[📣 Broadcast Message] dropdown** — choose WhatsApp, Email, or Facebook; opens compose modal
- Quick view on card hover, filter by: Source, Assigned To, Date Range, Amount

#### Broadcast Message Modal
```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROADCAST MESSAGE TO LEADS                              [X]            │
├─────────────────────────────────────────────────────────────────────────┤
│  Channel:  [● WhatsApp]  [○ Email]  [○ Facebook Messenger]             │
│                                                                         │
│  Selected Leads: 47 leads  (Filter: All Open Leads)                    │
│                                                                         │
│  Template: [Select Saved Template ▼]  OR compose below                 │
│                                                                         │
│  Subject (Email only): [_________________________________________]       │
│                                                                         │
│  Message:                                                               │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │ Hi {customer_name}, this is KVB Green Energies. We wanted to  │      │
│  │ follow up on your enquiry regarding {lead_title}...           │      │
│  └───────────────────────────────────────────────────────────────┘      │
│  Variables: {customer_name} {lead_title} {assigned_to} {company}       │
│                                                                         │
│  Schedule: [Send Now ●]  [Schedule for Later ○]                        │
│                                                                         │
│                     [Preview]  [Send to 47 Leads →]                    │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Lead Detail Page
```
┌─────────────────────────────────────────────────────────────────────────┐
│  LEAD DETAILS - L-17062 Test Lead                      [Edit] [Actions] │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │ Pipeline: Ab Apps Demos │  │  [Timeline] [Notes] [Follow-up]     │   │
│  │ Stage: Webinar Attended │  │  [Stages] [Emails] [Products]       │   │
│  │ Assigned To: Sanjay Roka│  │  [WhatsApp] [Quotation] [Messages]  │   │
│  │ Source: Referral        │  │                                     │   │
│  │ Closing Date: NA        │  │  TIMELINE VIEW:                     │   │
│  │ Amount: NA              │  │  ● New Lead Added By Sanjay Roka    │   │
│  │                         │  │    Wed, Mar 25 - 2:19 PM            │   │
│  │ CUSTOM DETAILS:         │  │  ● Bulk WhatsApp Sent (Campaign #3) │   │
│  │ Demo Date: 26/3/2026    │  │    Mon, Apr 6 - 10:00 AM            │   │
│  └─────────────────────────┘  └─────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  ACTIONS: [Initiate Call] [Move To] [Add Notes] [Add Follow-up]         │
│           [Quotation] [📣 Send Message]                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Tabs:**
1. **Timeline** — complete activity history including bulk message events
2. **Notes** — text and voice notes
3. **Follow-up** — scheduled and completed follow-ups
4. **Stages Timeline** — stage change history
5. **Emails** — sent and received emails
6. **Products** — associated products
7. **WhatsApp** — WhatsApp message history
8. **Quotation** — related quotations
9. **Messages** — bulk message history for this lead (channel, campaign name, status, sent at)

---

### 5.4 QUOTATION PAGES

#### Create Quotation Page
```
┌─────────────────────────────────────────────────────────────────────────┐
│  CREATE QUOTATION                                          Version #1   │
├─────────────────────────────────────────────────────────────────────────┤
│  Selected Lead: L-17062              Quotation No: ZAPL757              │
│  Currency: INR                       Date: 3/4/2026                     │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │ Ref. No: [________]         │  │ Lead ID: L-17062                │   │
│  │ Ref. Date: [Date Picker]    │  │ Company Name: NA                │   │
│  │ Validity Date: [Date]       │  │ Contact: Sanjay Roka            │   │
│  │ Payment Terms: [________]   │  │ Mobile: 9643575696              │   │
│  │ Sales Person: Sanjay Roka   │  │ Email: NA                       │   │
│  │ Billing Address: [________] │  │ State: NA | City: NA            │   │
│  └─────────────────────────────┘  └─────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  PRODUCT DETAILS                                                        │
│  ┌────┬────────────┬──────────────────────────────┬─────┬──────┬──────┐ │
│  │ #  │ Product    │ Description (Editable) ✏      │ Qty │ Price│Total │ │
│  ├────┼────────────┼──────────────────────────────┼─────┼──────┼──────┤ │
│  │ 1  │[Product ▼] │[Auto-filled, click to edit…] │[__] │[____]│₹0.00 │ │
│  │    │            │  Dis [__] Tax [__] UOM [__]  │     │      │      │ │
│  └────┴────────────┴──────────────────────────────┴─────┴──────┴──────┘ │
│  [+ Add Product]                                                        │
│  ℹ️  Description pre-filled from catalogue. Edit freely per customer.   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │ [+] Notes                   │  │  Total Amount:     ₹0.00/-      │   │
│  │ [+] Terms & Conditions      │  │  Discount:         ₹0.00/-      │   │
│  │                             │  │  Taxable Amount:   ₹0.00/-      │   │
│  │                             │  │  Tax:              ₹0.00/-      │   │
│  │                             │  │  Grand Total:      ₹0.00/-      │   │
│  └─────────────────────────────┘  └─────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                              [Save] [Save & Send]                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Editable Description Behavior:**
- When a product is selected, the Description field auto-populates from `product.description`
- The field is a multi-line text area — user can fully edit, extend, or replace the text
- Edited description is stored in `quotation_items.description` and appears on the generated PDF
- The master product record in the catalogue is never altered

#### All Quotations Page
- List view with filters
- Columns: Quotation #, Customer, Date, Amount, Status, Actions
- Actions: View, Edit, Download PDF, Send, Convert to Sale, Delete
- Status badges: Draft, Sent, Approved, Rejected, Converted, Expired

---

### 5.5 SALES PAGES

#### Sales List Page
- Table view with sorting and filtering
- Columns: Sale #, Customer, Date, Amount, Status, Payment Status, Actions
- Payment status badges: Unpaid, Partial, Paid, Overdue
- Quick actions: View, Edit, Generate Invoice, Record Payment

#### Create Sale Page
- Same editable per-line-item description as Quotation
- Additional fields: Payment terms, Expected delivery date, Delivery address
- Payment recording section

#### Invoice View
- Professional PDF layout, KVB Green Energies branding, GST-compliant format
- Includes customized line-item descriptions
- CGST, SGST/IGST breakdown, total in words, authorized signature space
- PDF saved locally at `/uploads/invoices/`

---

### 5.6 PURCHASE MODULE PAGES

#### Vendor Management Page
- Vendor list with search, Add/Edit vendor modal, vendor details view, purchase history per vendor

#### Purchase Order List
- Table with PO number, vendor, date, amount, status
- Filter by status, vendor, date range
- Actions: View, Edit, Download PDF, Mark as Received

#### Create Purchase Order
- Vendor selection, item details (free text), quantity, pricing, expected delivery, terms

---

### 5.7 TASK/TO-DO PAGES

#### Task Dashboard
```
┌─────────────────────────────────────────────────────────────────────────┐
│  TASK DASHBOARD                                          [+ Assign Task]│
├─────────────────────────────────────────────────────────────────────────┤
│  [Overdue: 350] [Pending: 1] [In Progress: 0] [Completed: 12]           │
│  [In Time: 12] [Delayed: 0]                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Filter: [Assigned To ▼] [Category ▼] [Tag ▼] [Frequency ▼] [Search]  │
├─────────────────────────────────────────────────────────────────────────┤
│  EMPLOYEE WISE PERFORMANCE:                                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Employee Name │ Total │ Score │ Overdue │ Pending │ In Progress│     │
│  │ Kanika Gupta  │  42   │ 41.1% │  38     │   0     │     4      │     │
│  │ Gaurav Kumar  │  48   │ 59.0% │  45     │   0     │     3      │     │
│  │ Sahil Raj     │  57   │ 56.7% │  56     │   0     │     1      │     │
│  └────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### My Tasks Page
- List of assigned tasks, grouped by: Overdue, Today, Upcoming, Completed
- Task cards with: title, description, due date, priority indicator, status, checklist progress
- **🎙 Voice Note icon on card** — plays assignment voice note left by owner
- Quick actions: Complete (with voice), Edit, Delete

#### Assign New Task Modal
```
┌─────────────────────────────────────────────────────────────────────────┐
│  ASSIGN NEW TASK                                        [Assign More □] │
├─────────────────────────────────────────────────────────────────────────┤
│  Add Title: [________________________________________________]          │
│  Add Description: [__________________________________________]          │
│                                                                         │
│  [+ Add Checklist]  Type and Hit Enter                                  │
│                                                                         │
│  [Users (1)] [Start Date] [High ▼] [Email & Wh...] [In Loop]           │
│  [☑ Repeat] [Daily ▼] [End Date]                                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  🎤 ASSIGNMENT VOICE NOTE (Optional)                            │    │
│  │  Record a voice message for the worker explaining this task.    │    │
│  │  [● Record]  [▶ Play]  [🗑 Delete]   Duration: 0:00            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│                              [Assign Task]                              │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Task Completion Modal (Worker Side)
```
┌─────────────────────────────────────────────────────────────────────────┐
│  MARK TASK AS COMPLETE                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Task: "Install solar panels at Site B"                                 │
│                                                                         │
│  🎙 Assignment Note (from Owner):                                       │
│  [▶ Play Recording]  "Ensure grounding is per spec…" (0:42)            │
│                                                                         │
│  Completion Notes (Optional text):                                      │
│  [________________________________________________]                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  🎤 COMPLETION VOICE NOTE (Optional)                            │    │
│  │  Record a summary of what was done, any issues, or confirmation │    │
│  │  [● Record]  [▶ Play]  [🗑 Delete]   Duration: 0:00            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│                    [Cancel]  [✓ Mark as Complete]                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Voice Recording Technical Flow (Local Storage):**
1. Browser's `MediaRecorder` API captures audio via microphone in the frontend
2. Recorded audio blob is sent via `multipart/form-data` to `POST /api/upload/voice`
3. Backend (`voiceStorage.service.js`) saves the file to local disk: `backend/uploads/voice/tasks/{taskId}/assign.webm` or `complete.webm`
4. The server-relative path (e.g. `/uploads/voice/tasks/{taskId}/assign.webm`) is returned to the frontend and saved in `task.assignmentVoiceUrl` or `task.completionVoiceUrl`
5. Playback uses a native HTML5 `<audio>` element pointing to the protected Express static route: `GET /api/files/voice/tasks/{taskId}/assign.webm`
6. The file route validates JWT before serving the file, ensuring only authenticated users can access recordings
7. Admin/owner receives a push notification when a completion voice note is added

---

### 5.8 FOLLOW-UP PAGES

#### Add Follow-up Modal
```
┌─────────────────────────────────────────────────────────────────────────┐
│  ADD FOLLOW-UP                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Follow-up Type: [Call ✓] [WhatsApp] [Email]                           │
│  Follow-up Description: [________________________________________________]
│  Follow-up Date: [10/4/2026 12:00 PM ▼]                                 │
│  [🔔 Add Followup Reminders]                                            │
│                              [+ Add Follow-up]                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Schedule Follow-up Reminders Modal
```
┌─────────────────────────────────────────────────────────────────────────┐
│  SCHEDULE FOLLOW-UP REMINDERS                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Where should we remind you?                                            │
│  [☑ Mobile App] [☑ WhatsApp] [○ Email]                                 │
│  When should we remind you?                                             │
│  [10] [minutes ▼]  [● Before] [○ After]    [🗑 Delete]                 │
│  [+ Add More]                        [💾 Save]                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 5.9 REPORTS PAGES

#### Daily Report Page
- Calendar view to select date
- Form with: Leads created (auto), Leads contacted, Follow-ups done, Quotations sent, Sales closed, Revenue generated, Activities description, Challenges faced, Next day plan
- Submit button

#### Performance Reports
- Employee-wise performance charts
- Monthly comparison, Target vs Achievement
- Lead source analysis, Conversion rate tracking
- Bulk message campaign performance (sent, delivered, failed counts per campaign)
- Export to Excel/PDF

---

### 5.10 SETTINGS PAGES

#### User Management (Admin Only)
- User list with roles, Add/Edit user modal, Activate/Deactivate, Reset password

#### Company Settings
- Company profile, logo upload (stored locally), GST details, bank details for invoices
- Meta Business API configuration (WhatsApp + Facebook), Email service configuration

#### Product Management
- Product list
- Add/Edit product (base description editable here for the catalogue)
- Category management, Price history

#### Message Templates
- Saved templates for bulk WhatsApp, Email, and Facebook messages
- Template variables: `{customer_name}`, `{lead_title}`, `{assigned_to}`, `{company}`, `{phone}`, `{quotation_link}`
- Create, edit, delete templates; preview per channel

---

## 6. API Endpoints Structure

### Authentication
```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me
```

### Users
```
GET    /api/users
POST   /api/users
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id
```

### Leads
```
GET    /api/leads                         # List with filters
POST   /api/leads                         # Create lead
GET    /api/leads/:id                     # Get lead details
PUT    /api/leads/:id                     # Update lead
DELETE /api/leads/:id                     # Delete lead
POST   /api/leads/:id/assign              # Assign lead
PUT    /api/leads/:id/status              # Update status
GET    /api/leads/:id/timeline            # Get timeline
POST   /api/leads/:id/notes               # Add note
POST   /api/leads/:id/followups           # Add follow-up
GET    /api/leads/:id/followups           # Get follow-ups
POST   /api/leads/:id/emails              # Send email
POST   /api/leads/:id/whatsapp            # Send WhatsApp
GET    /api/leads/:id/messages            # Bulk message history for lead
```

### Bulk Messaging
```
POST   /api/bulk-messages/campaigns            # Create & send campaign
GET    /api/bulk-messages/campaigns            # List all campaigns
GET    /api/bulk-messages/campaigns/:id        # Campaign details + stats
POST   /api/bulk-messages/campaigns/:id/retry  # Retry failed sends
GET    /api/bulk-messages/templates            # List message templates
POST   /api/bulk-messages/templates            # Create template
PUT    /api/bulk-messages/templates/:id        # Update template
DELETE /api/bulk-messages/templates/:id        # Delete template
```

### Quotations
```
GET    /api/quotations
POST   /api/quotations
GET    /api/quotations/:id
PUT    /api/quotations/:id
DELETE /api/quotations/:id
POST   /api/quotations/:id/convert         # Convert to sale
POST   /api/quotations/:id/send            # Send to customer
GET    /api/quotations/:id/pdf             # Download PDF from local storage
```

### Sales
```
GET    /api/sales
POST   /api/sales
GET    /api/sales/:id
PUT    /api/sales/:id
POST   /api/sales/:id/payments             # Record payment
GET    /api/sales/:id/invoice              # Download invoice PDF from local storage
```

### Tasks
```
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/:id
PUT    /api/tasks/:id
DELETE /api/tasks/:id
PUT    /api/tasks/:id/complete             # Mark complete (with optional voice path)
PUT    /api/tasks/:id/reopen              # Reopen task
```

### Voice Upload
```
POST   /api/upload/voice                  # Upload voice recording → returns local file path
GET    /api/files/voice/:type/:id/:file   # Serve protected voice file (JWT-gated)
```

### Dashboard
```
GET    /api/dashboard/admin
GET    /api/dashboard/employee
GET    /api/dashboard/metrics
GET    /api/dashboard/charts
```

### Sales Targets
```
GET    /api/targets                          # List targets (admin: all; employee: own)
POST   /api/targets                          # Create target (admin only)
GET    /api/targets/:id                      # Get single target
PUT    /api/targets/:id                      # Update target (admin only)
DELETE /api/targets/:id                      # Delete target (admin only)
GET    /api/targets/leaderboard              # Ranked attainment for current period
```

### Notifications
```
GET    /api/notifications                    # List notifications for current user
PUT    /api/notifications/:id/read           # Mark single notification as read
PUT    /api/notifications/read-all           # Mark all as read
DELETE /api/notifications/:id               # Delete notification
```

### Performance Scorecard & Export
```
GET    /api/reports/scorecard/:userId        # Computed scorecard for a user/period
GET    /api/reports/scorecard/export         # Export scorecard to Excel/CSV
GET    /api/leads/export                     # Export leads list (filter-aware)
GET    /api/sales/export                     # Export sales list
GET    /api/payments/export                  # Export payment history
GET    /api/customers/export                 # Export customer directory
GET    /api/reports/daily/export             # Export daily reports
```

### Deduplication
```
GET    /api/customers/check-duplicate        # ?phone=&email= — returns match if found
POST   /api/customers/:id/merge/:targetId    # Admin: merge two customer records
GET    /api/customers/duplicates             # Admin report of suspected duplicates
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup — React + Vite frontend, Node.js + Express backend, MySQL 8.x, Prisma
- [ ] **Socket.IO setup** — attach Socket.IO server to Express HTTP server; implement JWT auth middleware for socket handshake; create per-user rooms (`socket.join(userId)`)
- [ ] Local `uploads/` directory structure and protected static file route
- [ ] Database schema implementation (including `SalesTarget`, `Notification` models)
- [ ] Authentication system (Login, Logout, Forgot Password)
- [ ] User management (CRUD)
- [ ] Basic layout and navigation using CSS + shadcn/ui
- [ ] Notification bell component wired to Socket.IO client

### Phase 2: Lead Management (Week 3-4)
- [ ] Lead CRUD operations
- [ ] **Lead deduplication check** — `GET /api/customers/check-duplicate` debounced on phone/email input; 409 warning banner in create-lead form; `@@index([phone, email])` on `customers` table
- [ ] Lead pipeline (Kanban view) with lead checkboxes
- [ ] Lead details page with tabs (including Messages tab)
- [ ] Notes and timeline
- [ ] Basic follow-ups
- [ ] **Socket.IO events**: emit `LEAD_ASSIGNED` and `LEAD_STATUS_CHANGED` on relevant mutations

### Phase 3: Sales & Quotation (Week 5-6)
- [ ] Product management (editable base description in catalogue)
- [ ] Quotation creation with **editable per-line-item description**
- [ ] PDF generation via Puppeteer, saved to local `uploads/quotations/`
- [ ] Sale creation from quotation (description carries over)
- [ ] Invoice generation saved to local `uploads/invoices/`
- [ ] Payment tracking
- [ ] **Payment Receipt PDF** — on every `POST /api/sales/:id/payments`, Puppeteer generates `RCP-XXXXX.pdf` saved to `uploads/receipts/`; path stored in `payment.receiptUrl`; emit `PAYMENT_RECEIVED` Socket.IO event to sale owner and admin
- [ ] **Export endpoints** for Sales, Payments (`exceljs` — no file saved to disk, streamed directly)

### Phase 4: Purchase Module (Week 7)
- [ ] Vendor management
- [ ] Purchase order creation and PDF (saved locally)

### Phase 5: Task & Reports — Including Voice (Week 8)
- [ ] Task management with voice recording fields
- [ ] Voice upload API — saves recordings to local `uploads/voice/`
- [ ] JWT-gated static file route for voice playback
- [ ] Assignment voice note recording in Assign Task modal
- [ ] Completion voice note recording in Mark Complete modal
- [ ] Voice playback in task cards and detail view
- [ ] Daily reports and performance tracking
- [ ] **Employee Sales Targets** — admin CRUD for `SalesTarget`; nightly cron updates `revenueAchieved` / `leadsAchieved`; target progress widget on employee dashboard; emit `TARGET_MILESTONE` Socket.IO event at 50% and 100%
- [ ] **Employee Performance Scorecard** — `GET /api/reports/scorecard/:userId`; 5-KPI display with period selector and trend arrows
- [ ] **Socket.IO events**: emit `TASK_ASSIGNED` to assignee; `TASK_COMPLETED` (with voice note link) to creator

### Phase 6: Communication, Bulk Messaging & Reminders (Week 9)
- [ ] Email integration (SendGrid / Nodemailer)
- [ ] WhatsApp integration via Meta Business API (individual + bulk)
- [ ] Facebook Messenger API integration (bulk)
- [ ] **Bulk Lead Messaging feature** — Select All, compose, send campaign
- [ ] Message template management
- [ ] Follow-up reminder system (node-cron)
- [ ] Notification system

### Phase 7: Dashboard & Analytics (Week 10)
- [ ] Admin dashboard
- [ ] Employee dashboard (including target progress bar)
- [ ] Charts and reports
- [ ] Bulk message campaign analytics
- [ ] **Export functionality** — Excel/CSV export for all major modules (leads, sales, payments, customers, daily reports, scorecard) via streamed `exceljs` responses

### Phase 8: Testing & Deployment (Week 11-12)
- [ ] Unit testing
- [ ] Integration testing (voice recording, bulk message flows, local file serving)
- [ ] Socket.IO connection tests — verify room-based delivery, JWT auth on handshake, offline notification persistence
- [ ] Deduplication tests — phone/email collision detection, merge flow, duplicate report
- [ ] Export tests — verify all modules stream correct `.xlsx`/`.csv` with active filters applied
- [ ] Sales target & scorecard tests — verify attainment calculation accuracy, milestone notifications
- [ ] User acceptance testing
- [ ] Deployment (ensure `uploads/` directory is persistent and backed up on server)
- [ ] Documentation

---

## 8. Security Considerations

1. **Authentication & Authorization**
   - JWT-based authentication
   - Role-based access control (RBAC)
   - Password hashing with bcrypt
   - Session management

2. **Data Protection**
   - Input validation and sanitization
   - SQL injection prevention (Prisma ORM with parameterized queries — MySQL-safe)
   - XSS protection
   - CSRF protection

3. **API Security**
   - Rate limiting
   - API key authentication for external services (Meta Business API, SendGrid)
   - Request logging
   - **Socket.IO auth** — JWT verified on every WebSocket handshake via `socket.io` middleware; unauthenticated connections rejected before joining any room

4. **Local File Security**
   - Voice file type validation (accept only `.webm`, `.mp3`, `.ogg`)
   - File size limits (max 10MB per voice note)
   - All files served through a JWT-authenticated route (`GET /api/files/...`) — direct public URL access to `uploads/` is blocked via web server config (nginx `deny all` on `/uploads`)
   - Server-side file path sanitization to prevent directory traversal attacks
   - Regular server-side backup of the `uploads/` directory

5. **Bulk Messaging Safety**
   - Admin-only access for full bulk send; employees limited to their assigned leads
   - Rate limiting on bulk send API to comply with Meta Business API policies
   - Opt-out/unsubscribe flag on Customer record respected before sending

---

## 9. Additional Features (Future Enhancements)

1. **Mobile App** — React Native companion app with native voice recording
2. **AI Features** — Lead scoring, sentiment analysis, voice-to-text transcription for notes
3. **Advanced Analytics** — Predictive analytics, forecasting, bulk message ROI tracking
4. **Cloud Storage Migration** — Move from local storage to a cloud provider (AWS S3, Cloudflare R2) if storage needs grow
5. **Integration** — Accounting software (Tally, Zoho Books)
6. **Customer Portal** — Self-service for customers
7. **Multi-language Support** — Regional language support
8. **Offline Mode** — Work without internet; voice recordings queued and uploaded on reconnect
9. **Facebook Lead Ads Integration** — Auto-import leads from Facebook Lead Ads into CRM

---

## 10. Estimated Timeline & Resources

| Phase | Duration | Developers |
|-------|----------|------------|
| Phase 1 — Foundation (React + Vite, MySQL, Local Storage, Socket.IO) | 2 weeks | 2 |
| Phase 2 — Lead Management + Deduplication | 2 weeks | 2 |
| Phase 3 — Sales & Quotation (Payment Receipt PDF, Export) | 2 weeks | 2 |
| Phase 4 — Purchase Module | 1 week | 2 |
| Phase 5 — Task & Voice Recording + Employee Targets + Scorecard | 1 week | 2 |
| Phase 6 — Communication & Bulk Messaging | 1 week | 2 |
| Phase 7 — Dashboard, Analytics & Export | 1 week | 2 |
| Phase 8 — Testing & Deployment | 2 weeks | 2 |
| **Total** | **12 weeks** | **2 developers** |

---

**Document Version:** 4.0
**Updated:** April 7, 2026
**Changes from v3.0:**
- **Employee Sales Targets** — Added `SalesTarget` Prisma model with monthly/quarterly periods, revenue/lead/quotation KPIs, auto-attainment tracking via cron, milestone notifications, and leaderboard. New module §4.8, API group `targets`, Phase 5 updated.
- **Payment Receipt PDF** — Added `receiptUrl` field to `Payment` model. Auto-generated Puppeteer PDF on every payment save, stored at `uploads/receipts/`, downloadable from payment history. Phase 3 and Sales module §4.1 updated.
- **Real-Time Notifications (Socket.IO)** — Added Socket.IO to tech stack and app structure. New `Notification` Prisma model with `NotificationType` enum. Room-based per-user delivery. Covers task assignment/completion, lead changes, follow-up due alerts, payment received, bulk message done, and target milestones. New module §4.9, Phase 1 setup, Phase 2/5 events documented.
- **Lead Deduplication Check** — Added pre-save phone/email uniqueness check on `POST /api/leads` and `POST /api/customers`. Frontend 409 warning banner with merge/override option. Admin duplicate report and merge endpoint. New module §4.11, Phase 2 updated.
- **Employee Performance Scorecard** — Added computed 5-KPI scorecard (conversion rate, follow-up response time, on-time task completion, revenue generated, target attainment). Trend arrows vs previous period. Export to Excel/CSV. New module §4.10, Phase 5 updated.
- **Export to Excel/CSV** — Added `exceljs`-powered streamed export endpoints for all major modules (leads, sales, payments, customers, daily reports, scorecard). Filter-aware; no server-side file saved. New module §4.12, Phase 7 updated. Export API endpoints group added to §6.
- **Permission Matrix** — Updated §3.2 with new rows for Sales Targets, Scorecard, Export, and Notifications.
- **Application Structure** — Added `socket.service.js` to backend services.

**For:** KVB Green Energies CRM Project
