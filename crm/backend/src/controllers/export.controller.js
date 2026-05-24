const { eq, and, inArray, sql } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { Parser } = require('json2csv');
const { getSubordinateIds } = require('../middleware/permission.middleware');
const { randomUUID } = require('crypto');

/**
 * export.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Secure data export — queries are scoped to the requesting user's visibility.
 * Admins see all data. Employees only see data within their hierarchy.
 * Every export is audit-logged with who exported what and when.
 * Admins are notified via Socket.IO when a non-admin performs an export.
 */

// ── Internal helper: write an audit log entry for every export ──────────────
const logExportAudit = async (userId, exportType, rowCount) => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS export_audit_logs (
        id          VARCHAR(36)  NOT NULL PRIMARY KEY,
        userId      VARCHAR(36)  NOT NULL,
        exportType  VARCHAR(50)  NOT NULL,
        rowCount    INT          NOT NULL DEFAULT 0,
        exportedAt  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      INSERT INTO export_audit_logs (id, userId, exportType, rowCount, exportedAt)
      VALUES (${randomUUID()}, ${userId}, ${exportType}, ${rowCount}, NOW())
    `);
  } catch (_) {
    // Audit failure must never block the actual export — log silently
    console.error('[ExportAudit] Failed to write audit log:', _.message);
  }
};

exports.exportData = async (req, res) => {
  try {
    const { type } = req.params;
    const { role, id: userId } = req.user;
    let data = [];
    let fields = [];

    // ── Determine which user IDs this requester is allowed to see ───────────
    let visibleUserIds = [];
    if (role !== 'ADMIN') {
      visibleUserIds = await getSubordinateIds(userId, true);
      visibleUserIds.push(userId);
    }

    // ── Scoped query per export type ─────────────────────────────────────────
    switch (type) {
      case 'leads': {
        const leadConds = [eq(schema.leads.isArchived, false)];
        if (role !== 'ADMIN') {
          leadConds.push(inArray(schema.leads.assignedToId, visibleUserIds));
        }

        const leadsRaw = await db.select({
          id: schema.leads.id,
          leadNumber: schema.leads.leadNumber,
          title: schema.leads.title,
          status: schema.leads.status,
          source: schema.leads.source,
          estimateAmount: schema.leads.estimateAmount,
          customerContactName: schema.customers.contactName,
          customerPhone: schema.customers.phone,
          assignedToFirstName: schema.users.firstName,
          assignedToLastName: schema.users.lastName,
          createdAt: schema.leads.createdAt
        })
        .from(schema.leads)
        .leftJoin(schema.customers, eq(schema.leads.customerId, schema.customers.id))
        .leftJoin(schema.users, eq(schema.leads.assignedToId, schema.users.id))
        .where(and(...leadConds));

        data = leadsRaw.map(l => ({
          id: l.id,
          leadNumber: l.leadNumber,
          title: l.title,
          status: l.status,
          source: l.source,
          estimateAmount: l.estimateAmount,
          'customer.contactName': l.customerContactName || '',
          'customer.phone': l.customerPhone || '',
          'assignedTo.firstName': l.assignedToFirstName || '',
          'assignedTo.lastName': l.assignedToLastName || '',
          createdAt: l.createdAt
        }));

        fields = [
          'id', 'leadNumber', 'title', 'status', 'source', 'estimateAmount',
          'customer.contactName', 'customer.phone',
          'assignedTo.firstName', 'assignedTo.lastName', 'createdAt'
        ];
        break;
      }

      case 'sales': {
        const saleConds = [];
        if (role !== 'ADMIN') {
          saleConds.push(inArray(schema.sales.createdById, visibleUserIds));
        }

        const salesRaw = await db.select({
          id: schema.sales.id,
          saleNumber: schema.sales.saleNumber,
          totalAmount: schema.sales.totalAmount,
          status: schema.sales.status,
          paymentStatus: schema.sales.paymentStatus,
          saleDate: schema.sales.saleDate,
          customerContactName: schema.customers.contactName,
          createdByFirstName: schema.users.firstName,
          createdByLastName: schema.users.lastName
        })
        .from(schema.sales)
        .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
        .leftJoin(schema.users, eq(schema.sales.createdById, schema.users.id))
        .where(saleConds.length > 0 ? and(...saleConds) : undefined);

        data = salesRaw.map(s => ({
          id: s.id,
          saleNumber: s.saleNumber,
          totalAmount: s.totalAmount,
          status: s.status,
          paymentStatus: s.paymentStatus,
          'customer.contactName': s.customerContactName || '',
          'createdBy.firstName': s.createdByFirstName || '',
          'createdBy.lastName': s.createdByLastName || '',
          saleDate: s.saleDate
        }));

        fields = [
          'id', 'saleNumber', 'totalAmount', 'status', 'paymentStatus',
          'customer.contactName', 'createdBy.firstName', 'createdBy.lastName', 'saleDate'
        ];
        break;
      }

      case 'purchases': {
        // Purchase Orders are Admin-only — employees do not have visibility
        if (role !== 'ADMIN') {
          return res.status(403).json({
            success: false,
            message: 'Purchase order exports are restricted to Admins only.'
          });
        }

        const purchasesRaw = await db.select({
          id: schema.purchaseOrders.id,
          poNumber: schema.purchaseOrders.poNumber,
          totalAmount: schema.purchaseOrders.totalAmount,
          status: schema.purchaseOrders.status,
          vendorCompanyName: schema.vendors.companyName,
          orderDate: schema.purchaseOrders.orderDate
        })
        .from(schema.purchaseOrders)
        .leftJoin(schema.vendors, eq(schema.purchaseOrders.vendorId, schema.vendors.id));

        data = purchasesRaw.map(p => ({
          id: p.id,
          poNumber: p.poNumber,
          'vendor.companyName': p.vendorCompanyName || '',
          totalAmount: p.totalAmount,
          status: p.status,
          orderDate: p.orderDate
        }));

        fields = ['id', 'poNumber', 'vendor.companyName', 'totalAmount', 'status', 'orderDate'];
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type. Must be leads, sales, or purchases'
        });
    }

    if (data.length === 0) {
      return res.status(404).json({ success: false, message: 'No records found to export' });
    }

    // ── Write audit log (non-blocking) ───────────────────────────────────────
    logExportAudit(userId, type, data.length).catch(() => {});

    // ── Notify Admin via Socket.IO when a non-admin exports ──────────────────
    if (role !== 'ADMIN') {
      const io = req.app.get('io');
      if (io) {
        const userList = await db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);
        const user = userList[0];
        io.emit('notification', {
          type: 'DATA_EXPORT',
          title: 'Data Export Performed',
          body: `${user?.firstName || ''} ${user?.lastName || ''} exported ${data.length} ${type} records.`,
          targetRole: 'ADMIN'
        });
      }
    }

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment(`${type}-${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);

  } catch (error) {
    console.error('[Export] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
