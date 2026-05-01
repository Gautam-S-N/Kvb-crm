# KVB CRM - Master Technical Architecture

This document serves as the absolute engineering blueprint for the entire KVB CRM. It details the infrastructure, database optimization techniques, background processes, and frontend state management.

---

## 1. System Overview & Monorepo Structure
The application is structured as a Monorepo containing two distinct environments:
*   `/backend`: A Node.js / Express REST API.
*   `/frontend`: A React / Vite Single Page Application.
Communication occurs via REST endpoints (Axios).

---

## 2. Database Design & Prisma ORM Optimization (MySQL)
The schema (`schema.prisma`) implements several complex strategies for scale and integrity.

### 2.1 The Materialized Path Hierarchy
To eliminate recursive `N+1` database queries when searching for a manager's subordinates, the `User` model features a `hierarchyPath` string (e.g., `/adminId/managerId/employeeId/`). 
*   Fetching a manager's entire deep organizational subtree is an `O(1)` operation using a SQL `contains` query.
*   When a user's manager is reassigned via the `user.controller`, the system dynamically rebuilds the new path and cascades the update to all downstream subordinates automatically.

### 2.2 Time-Travel Snapshots
If an employee is reassigned to a new manager, past analytics must remain accurate for the old manager.
*   The `Lead` and `Task` models feature a `snapshotManagerId` column.
*   When a Lead is closed (`WON`/`LOST`) or a Task is `COMPLETED`, the system permanently freezes the assignee's *current* `managerId` into the snapshot column, locking historical credit.

### 2.3 Concurrency & Race-Condition Locking
To prevent two sales reps from generating Quotation `#1001` simultaneously, the system uses an atomic lock model. 
*   `QuotationReservation` securely locks the increment counter during PDF drafting.
*   If the quote is not saved, the reservation expires and releases the number back to the pool.

### 2.4 Data Integrity via Soft Deletes
The API never executes SQL `DELETE` commands on critical records. Leads and Tasks utilize an `isArchived: true` boolean and a `deletedAt` timestamp. All `GET` queries apply a strict filter to hide these records while preserving them for audit logs.

### 2.5 Hybrid Permissions (RBAC)
Instead of parsing a heavy JSON payload on every route, the schema features native high-speed boolean columns (`canAssignLeads`, `canAssignTasks`). The `requireElevated` Express middleware validates these columns at blistering speed.

---

## 3. Backend Logic (Node/Express)

### 3.1 Background Automation (node-cron)
The server runs headless background jobs:
1.  **`leadEscalation.js`:** Runs daily. It scans the DB for active leads untouched for >7 days. It pushes a Socket.io warning to the employee and an escalation notice to their manager.
2.  **`targetAutomation.js`:** Periodically recalculates the `revenueAchieved` across `SalesTargets`. It automatically handles "Target Roll-Ups" by summing the manager's direct sales with the achieved metrics of their subordinates' sub-targets.
3.  **`followupReminder.js`:** Pushes real-time alerts for scheduled calls due today.

### 3.2 Key Controller Workflows
*   **Media Uploads (`upload.controller.js`):** Handles multipart form data for uploading profile avatars, task proof photos, and completing tasks with `.mp3` Voice Notes.
*   **PDF Generation:** Quotation and PO controllers use internal templating to build and save PDF binaries to the disk, storing the URL string in the database.

---

## 4. Frontend Architecture (React/Vite)

### 4.1 State Management (Zustand)
The frontend relies heavily on **Zustand** rather than Redux.
*   The `src/stores/` directory contains modular hooks (e.g., `useLeadStore`, `useUserStore`, `useTaskStore`).
*   Stores manage Axios `GET/POST` requests, maintain `isLoading`/`error` states, and hold the JSON arrays that the UI components map over.

### 4.3 Intelligent UI Logic & Error Interception
The UI actively assists in protecting database constraints:
*   **The Handover Modal:** If an Admin attempts to suspend a Manager, the Axios request fires. The backend detects active subordinates and throws a `409 MANAGER_HAS_SUBORDINATES` error. The `UserManagement.jsx` file catches this exact code and renders a Handover Modal, forcing the Admin to execute a bulk `transferSubordinates` API call before the suspension is allowed to proceed.
*   **Geo-Location Logic:** The `DailyReports.jsx` component leverages the browser's `navigator.geolocation` API to capture Latitude/Longitude upon submission. This data is rendered inside `EmployeeTracking.jsx` for management using integrated maps.

---

## Appendix: Exhaustive Database Schema Manifest

For total project clarity, here is the exhaustive list of every database table supporting the CRM:

1.  **User Management & Security**
    *   `users`: Core employee tracking with RBAC enums (`ADMIN`, `MANAGER`, `EMPLOYEE`), native permission boolean columns, and the `hierarchyPath` string.
    *   `activity_logs`: Global system tracking mapping any CRUD action to an `entityType` and `entityId`.
2.  **Customer & Sales Engine**
    *   `customers`: Contact database supporting multiple phones, locations, and social links (Facebook PSID).
    *   `leads`: The pipeline object. Includes `LeadStatus` and `LeadSource` enums, plus the `snapshotManagerId` for time-travel.
    *   `lead_products`: Junction table linking leads to interested products.
    *   `lead_timelines`: Tracking history of status transitions.
    *   `follow_ups`: Scheduled call reminders linked to a lead.
    *   `notes`: Rich text notes attached to a lead.
3.  **Quotations & Pricing**
    *   `products`: Master sales catalog (Base prices, GST % rates, HSN codes).
    *   `quotations`: Saved estimates with tax breakouts.
    *   `quotation_items`: Line items on the quote (links to a Product or custom text).
    *   `quotation_counters` / `quotation_reservations`: Atomic locking system to generate unique sequential numbers safely.
4.  **Financial Realization**
    *   `sales`: Finalized invoices. Links back to `Quotations`. Tracks total amounts and expected delivery dates.
    *   `sale_items`: Snapshot of items sold.
    *   `payments`: Logs individual payment tranches against a sale, including `paymentMethod`, `referenceNumber`, and `receiptUrl`.
5.  **Procurement & Inventory**
    *   `vendors`: External suppliers list.
    *   `purchase_items`: Master catalog of things the company buys.
    *   `purchase_orders`: Generated POs sent to vendors.
    *   `purchase_order_items`: Line items requested.
    *   `materials`: Warehouse tracking of physical inventory, tracking `inQty`, `outQty`, and `balance`.
6.  **Employee Productivity**
    *   `tasks`: Assigned duties with priority levels and `snapshotManagerId`. Includes `attachmentUrl` and `completionVoiceUrl`.
    *   `task_checklist_items`: Sub-steps required for task completion.
    *   `todos`: Private Kanban cards for individual employees.
    *   `daily_reports`: End-of-day submissions with GPS coordinates.
7.  **Goals & Automation**
    *   `sales_targets`: Configured revenue/leads/quotes goals per period. Contains `parentTargetId` to roll up numbers from subordinates.
