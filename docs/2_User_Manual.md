# KVB CRM - Master User Manual

This manual provides instructions for utilizing every module inside the KVB CRM. It is structured to follow the lifecycle of an enterprise, from setting up catalogs to making sales and tracking employees.

---

## 1. Catalog & Inventory Setup
Before selling, Admins must populate the system databases.
*   **Products (Sales):** Go to `Products` -> `Create Product`. Enter the SKU, Base Price, Description, and the exact HSN/SAC code required for tax compliance.
*   **Purchase Items (Procurement):** Go to `Purchase Items`. These are the internal goods your company buys. Define units of measure and expected costs.
*   **Materials (Inventory):** Go to `Inventory`. Track raw materials here. You can manually `Check-In` stock deliveries or `Check-Out` stock used in operations.

## 2. Managing the Workforce (Admins/Managers)
*   **User Management:** Admins can create new employees. Click the "Key" icon on an employee row to toggle their specific permissions (e.g., allow them to assign leads to others).
*   **The Handover System:** If you attempt to Suspend an employee who is actively managing others, the CRM will block you. A popup will ask you to select a new manager. The system transfers the entire team to the new manager before applying the suspension.
*   **Sales Targets:** Go to `Sales Targets`. Create a quarterly revenue goal for a Manager. The Manager can then log in, view their target, and create sub-targets for their individual team members. The CRM handles the roll-up math automatically.
*   **Employee Tracking:** Open the `Employee Tracking` dashboard to view live charts and statistics of your team's productivity. You can see who has overdue tasks, completion rates, and an alert banner flagging any employees who currently have no assigned manager.

## 3. The Sales Pipeline
### Creating & Advancing Leads
1. Go to `Leads` and click `+ Create Lead`. Fill out the client's information.
2. Open the Lead and update its `Status`. Every status change is saved in the **Lead Timeline** tab.
3. Click `Add Follow-Up` to schedule a meeting. You will receive a push notification when the meeting is due.
4. If you neglect a lead for more than 7 days, the system will send an automated **Escalation Warning** to both you and your boss.
5. Once a deal is finalized, mark it `WON` or `LOST`. Doing so permanently snapshots your Manager's ID for historical credit.

### Quotations & Sales Generation
1. Go to `Quotations` and click `Create Quote`.
2. Add items from your `Product Catalog` or type in custom one-off items. The system calculates taxes and totals dynamically.
3. Save the Quote and click `Download PDF` to send to the client.
4. Once the client pays, open the Quote and click `Convert to Sale`.
5. Inside the new `Sale` record, update the `Payment Status` (e.g., Partial, Paid) and `Delivery Status`. Your Sales Target attainment meter will instantly increase!

## 4. Procurement Operations
When the company needs to buy supplies, you use the Vendor module.
1. Go to `Vendors` and click `+ Add Vendor`. Enter the supplier's GST info and payment terms.
2. Go to `Purchase Orders` and click `Create PO`.
3. Select the Vendor and add items from your `Purchase Items` catalog.
4. Save the PO. You can generate a PDF to email the supplier. Track the PO status from `SENT` to `RECEIVED` as the goods arrive.

## 5. Daily Employee Productivity
*   **Tasks:** Managers assign tasks to employees here. Open a task to see its `Checklist`. Check off items as you work. When marking it `COMPLETED`, click the microphone icon to record a quick audio summary of the work, or upload a photo of the completed job.
*   **To-Do List:** A private kanban board. Drag and drop sticky notes for your own mental tracking.
*   **Daily Reports:** At the end of the shift, click `Daily Reports`. Type a summary of what you did and click Submit.

