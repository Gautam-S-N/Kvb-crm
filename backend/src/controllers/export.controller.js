const prisma = require('../utils/db');
const { Parser } = require('json2csv');
const { getSubordinateIds } = require('../middleware/permission.middleware');

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
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS export_audit_logs (
        id          VARCHAR(36)  NOT NULL PRIMARY KEY,
        userId      VARCHAR(36)  NOT NULL,
        exportType  VARCHAR(50)  NOT NULL,
        rowCount    INT          NOT NULL DEFAULT 0,
        exportedAt  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(
      `INSERT INTO export_audit_logs (id, userId, exportType, rowCount, exportedAt) VALUES (?, ?, ?, ?, NOW())`,
      require('uuid').v4(), userId, exportType, rowCount
    );
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
        const where = { isArchived: false };
        if (role !== 'ADMIN') {
          where.assignedToId = { in: visibleUserIds };
        }
        data = await prisma.lead.findMany({
          where,
          select: {
            id: true, leadNumber: true, title: true, status: true,
            source: true, estimateAmount: true,
            customer: { select: { contactName: true, phone: true } },
            assignedTo: { select: { firstName: true, lastName: true } },
            createdAt: true
          }
        });
        fields = [
          'id', 'leadNumber', 'title', 'status', 'source', 'estimateAmount',
          'customer.contactName', 'customer.phone',
          'assignedTo.firstName', 'assignedTo.lastName', 'createdAt'
        ];
        break;
      }

      case 'sales': {
        const where = {};
        if (role !== 'ADMIN') {
          where.createdById = { in: visibleUserIds };
        }
        data = await prisma.sale.findMany({
          where,
          select: {
            id: true, saleNumber: true, totalAmount: true, status: true,
            paymentStatus: true, saleDate: true,
            customer: { select: { contactName: true } },
            createdBy: { select: { firstName: true, lastName: true } }
          }
        });
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
        data = await prisma.purchaseOrder.findMany({
          select: {
            id: true, poNumber: true, totalAmount: true, status: true,
            vendor: { select: { companyName: true } },
            orderDate: true
          }
        });
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
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true }
        });
        io.emit('notification', {
          type: 'DATA_EXPORT',
          title: 'Data Export Performed',
          body: `${user?.firstName} ${user?.lastName} exported ${data.length} ${type} records.`,
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
