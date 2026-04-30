/**
 * quotationNumber.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses raw SQL (prisma.$queryRawUnsafe / $executeRawUnsafe) so that the new
 * tables (quotation_counters, quotation_reservations) work WITHOUT needing to
 * regenerate the Prisma client.
 */
const prisma = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

// ─── Product Code Map ────────────────────────────────────────────────────────
const PRODUCT_CODE_MAP = {
  'SOLAR_TUNNEL_DRYER':     'STD',
  'SOLAR_PARABOLIC_TROUGH': 'PTC',
  'SOLAR_PARABOLIC_COOKER': 'SPC',
  'SCHEFFLER_DISH':         'SSD',
  'STANDARD':               'STD',
};

const RESERVATION_TTL_MINUTES = 10;

// ─── Formatting Helpers ────────────────────────────────────────────────────────
const getFormatSettings = async () => {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['QTN_COMPANY_CODE', 'QTN_DATE_FORMAT', 'QTN_PRODUCT_CODES'] } }
  });
  const dict = {};
  rows.forEach(r => dict[r.key] = r.value);
  return dict;
};

const formatDateBySetting = (date, formatType) => {
  if (formatType === 'NONE') return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y2 = String(date.getFullYear()).slice(-2);
  const y4 = String(date.getFullYear());
  if (formatType === 'MMDDYY') return `${m}${d}${y2}`;
  if (formatType === 'YYYYMMDD') return `${y4}${m}${d}`;
  return `${d}${m}${y2}`; // DDMMYY
};

const versionToLabel = (n) => String.fromCharCode(65 + n); // 0→A, 1→B …

const buildQuotationNumber = (companyCode, productCode, counter, versionLabel, dateStr) => {
  let num = `QTN.${companyCode}.${productCode}.${String(counter).padStart(3, '0')}.${versionLabel}`;
  if (dateStr) num += `.${dateStr}`;
  return num;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quotations/counters  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
exports.getCounters = async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT id, productCode, counter, updatedAt FROM quotation_counters ORDER BY productCode'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/quotations/counters/:productCode  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateCounter = async (req, res) => {
  try {
    const { productCode } = req.params;
    const { counter } = req.body;

    if (typeof counter !== 'number' || counter < 0) {
      return res.status(400).json({ success: false, message: 'counter must be a non-negative number' });
    }
    const validCodes = ['STD', 'PTC', 'SPC', 'SSD'];
    if (!validCodes.includes(productCode)) {
      return res.status(400).json({ success: false, message: 'Invalid product code' });
    }

    // Upsert using INSERT ... ON DUPLICATE KEY UPDATE
    await prisma.$executeRawUnsafe(
      `INSERT INTO quotation_counters (id, productCode, counter, updatedAt)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE counter = ?, updatedAt = NOW()`,
      uuidv4(), productCode, counter, counter
    );

    const [updated] = await prisma.$queryRawUnsafe(
      'SELECT id, productCode, counter, updatedAt FROM quotation_counters WHERE productCode = ?',
      productCode
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotations/reserve
// ─────────────────────────────────────────────────────────────────────────────
exports.reserveNumber = async (req, res) => {
  try {
    const { templateType = 'STANDARD' } = req.body;
    const settings = await getFormatSettings();
    let codeMap = PRODUCT_CODE_MAP;
    if (settings.QTN_PRODUCT_CODES) {
      try { codeMap = { ...codeMap, ...JSON.parse(settings.QTN_PRODUCT_CODES) }; } catch (e) {}
    }
    const productCode = codeMap[templateType] || 'STD';
    const companyCode = settings.QTN_COMPANY_CODE || 'KVB';
    const dateFormat = settings.QTN_DATE_FORMAT || 'DDMMYY';

    const userId = req.user.id;
    const now = new Date();

    // Clean expired reservations
    await prisma.$executeRawUnsafe(
      'DELETE FROM quotation_reservations WHERE productCode = ? AND expiresAt < ?',
      productCode, now
    );

    // Check if user already has an active reservation for this product
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, quotationNumber, expiresAt FROM quotation_reservations
       WHERE productCode = ? AND reservedBy = ? AND expiresAt > ?
       LIMIT 1`,
      productCode, userId, now
    );
    if (existing.length > 0) {
      const r = existing[0];
      return res.json({
        success: true,
        data: {
          quotationNumber: r.quotationNumber,
          reservationId: r.id,
          expiresAt: r.expiresAt,
          productCode,
        },
      });
    }

    // Atomically increment the counter
    await prisma.$executeRawUnsafe(
      `INSERT INTO quotation_counters (id, productCode, counter, updatedAt)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE counter = counter + 1, updatedAt = NOW()`,
      uuidv4(), productCode
    );

    const [counterRow] = await prisma.$queryRawUnsafe(
      'SELECT counter FROM quotation_counters WHERE productCode = ?',
      productCode
    );
    const newCounter = Number(counterRow.counter);
    const dateStr = formatDateBySetting(now, dateFormat);
    const quotationNumber = buildQuotationNumber(companyCode, productCode, newCounter, 'A', dateStr);

    const resId = uuidv4();
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    await prisma.$executeRawUnsafe(
      `INSERT INTO quotation_reservations (id, productCode, quotationNumber, reservedBy, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      resId, productCode, quotationNumber, userId, expiresAt
    );

    res.json({
      success: true,
      data: {
        quotationNumber,
        reservationId: resId,
        expiresAt,
        productCode,
        counter: newCounter,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/quotations/reserve/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.releaseReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const rows = await prisma.$queryRawUnsafe(
      'SELECT id, productCode FROM quotation_reservations WHERE id = ? AND reservedBy = ?',
      id, userId
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    const { productCode } = rows[0];
    await prisma.$executeRawUnsafe(
      'DELETE FROM quotation_reservations WHERE id = ?', id
    );
    // Decrement counter back (number is released)
    await prisma.$executeRawUnsafe(
      'UPDATE quotation_counters SET counter = GREATEST(counter - 1, 0) WHERE productCode = ?',
      productCode
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotations/:id/revise
// ─────────────────────────────────────────────────────────────────────────────
exports.reviseQuotation = async (req, res) => {
  try {
    const { id } = req.params;

    const original = await prisma.quotation.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!original) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // Determine root ID using raw SQL (parentId not in stale Prisma client)
    const [origRaw] = await prisma.$queryRawUnsafe(
      'SELECT parentId FROM quotations WHERE id = ?', id
    );
    const rootId = origRaw.parentId || id;

    // Count all versions under this root
    const [countRow] = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*) AS cnt FROM quotations WHERE id = ? OR parentId = ?',
      rootId, rootId
    );
    const versionCount = Number(countRow.cnt);
    const newVersionLabel = versionToLabel(versionCount); // A=0, B=1, C=2

    // Rebuild quotation number with new version (preserving formatting and custom prefixes)
    let newQtnNumber = original.quotationNumber;
    if (newQtnNumber.startsWith('QTN.')) {
      // QTN (0) . KVB (1) . STD (2) . 005 (3) . A (4) . [Date (5)]
      const parts = newQtnNumber.split('.');
      if (parts.length >= 5) {
        parts[4] = newVersionLabel;
        newQtnNumber = parts.join('.');
      }
    } else {
      // Legacy format: Q-00024 or Q-00024-B
      if (/-[A-Z]$/.test(newQtnNumber)) {
        newQtnNumber = newQtnNumber.slice(0, -1) + newVersionLabel;
      } else {
        newQtnNumber = newQtnNumber + '-' + newVersionLabel;
      }
    }

    // Mark all versions as not latest
    await prisma.$executeRawUnsafe(
      'UPDATE quotations SET isLatest = 0 WHERE id = ? OR parentId = ?',
      rootId, rootId
    );

    const {
      items,
      customFields,
      paymentTerms,
      deliveryTerms,
      notes,
      termsConditions,
      discountAmount,
      discountPercent,
    } = req.body;

    // Calculate totals from line items (similar to createQuotation)
    let subTotal = 0;
    const quotationItems = items.map(item => {
      const totalPrice = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      subTotal += totalPrice;
      return {
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        taxRate: item.taxRate || 18,
        totalPrice
      };
    });

    const discountAmt = discountAmount || (subTotal * (discountPercent || 0) / 100);
    let taxableAmount = subTotal - discountAmt;
    const gstRate = (customFields && customFields.gstRate != null) ? customFields.gstRate : 18;
    let taxAmount = taxableAmount * (gstRate / 100);
    let totalAmount = taxableAmount + taxAmount;

    // For Solar Tunnel Dryer
    if (original.templateType === 'SOLAR_TUNNEL_DRYER' && customFields) {
      const cfQty   = parseFloat(customFields.qty) || 1;
      const cfPrice = parseFloat(customFields.unitPrice) || parseFloat(customFields.totalAmt) || 0;
      const cfTotal = cfQty * cfPrice;
      customFields.totalAmt = cfTotal;
      customFields.unitPrice = cfPrice;
      if (cfTotal > 0) {
        totalAmount = cfTotal;
        taxAmount   = 0;
        subTotal    = cfTotal;
      }
    }

    // Create the new revision using the edited fields
    const newVersion = await prisma.quotation.create({
      data: {
        quotationNumber: newQtnNumber,
        version:         versionCount + 1,
        status:          'DRAFT',
        leadId:          original.leadId,
        customerId:      original.customerId,
        createdById:     req.user.id,
        subTotal,
        discountAmount:  discountAmt,
        discountPercent: discountPercent || 0,
        taxAmount,
        totalAmount,
        quotationDate:   new Date(),
        validUntil:      original.validUntil,
        paymentTerms,
        deliveryTerms,
        notes,
        termsConditions,
        templateType:    original.templateType,
        customFields:    customFields ? JSON.parse(JSON.stringify(customFields)) : null,
        items: {
          create: quotationItems
        },
      },

      include: {
        items: { include: { product: true } },
        customer: true,
        lead: true,
      },
    });

    // Set new versioning columns via raw SQL
    await prisma.$executeRawUnsafe(
      'UPDATE quotations SET versionLabel = ?, isLatest = 1, parentId = ? WHERE id = ?',
      newVersionLabel, rootId, newVersion.id
    );

    await prisma.leadTimeline.create({
      data: {
        leadId:      original.leadId,
        action:      'Quotation Revised',
        description: `Version ${newVersionLabel} created: ${newQtnNumber}`,
        performedBy: req.user.id,
      },
    });

    // Return enriched data with version info added
    res.status(201).json({
      success: true,
      data: { ...newVersion, versionLabel: newVersionLabel, parentId: rootId, isLatest: true },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quotations/:id/next-revision
// ─────────────────────────────────────────────────────────────────────────────
exports.getNextRevisionInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const original = await prisma.quotation.findUnique({ where: { id } });
    if (!original) return res.status(404).json({ success: false, message: 'Not found' });

    const [origRaw] = await prisma.$queryRawUnsafe('SELECT parentId FROM quotations WHERE id = ?', id);
    const rootId = origRaw?.parentId || id;

    const [countRow] = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*) AS cnt FROM quotations WHERE id = ? OR parentId = ?', rootId, rootId
    );
    const versionCount = Number(countRow.cnt);
    const newVersionLabel = versionToLabel(versionCount);

    let newQtnNumber = original.quotationNumber;
    if (newQtnNumber.startsWith('QTN.')) {
      const parts = newQtnNumber.split('.');
      if (parts.length >= 5) {
        parts[4] = newVersionLabel;
        newQtnNumber = parts.join('.');
      }
    } else {
      if (/-[A-Z]$/.test(newQtnNumber)) {
        newQtnNumber = newQtnNumber.slice(0, -1) + newVersionLabel;
      } else {
        newQtnNumber = newQtnNumber + '-' + newVersionLabel;
      }
    }

    res.json({
      success: true,
      data: { quotationNumber: newQtnNumber, versionLabel: newVersionLabel }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quotations/:id/versions
// ─────────────────────────────────────────────────────────────────────────────
exports.getVersionHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Get parentId via raw SQL
    const [qRow] = await prisma.$queryRawUnsafe(
      'SELECT id, parentId FROM quotations WHERE id = ?', id
    );
    if (!qRow) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const rootId = qRow.parentId || qRow.id;

    // Fetch all IDs in this version chain
    const versionIds = await prisma.$queryRawUnsafe(
      'SELECT id FROM quotations WHERE id = ? OR parentId = ? ORDER BY version ASC',
      rootId, rootId
    );

    const ids = versionIds.map(r => r.id);
    if (!ids.length) return res.json({ success: true, data: [] });

    // Fetch full quotation objects + extra raw fields
    const quotations = await prisma.quotation.findMany({
      where: { id: { in: ids } },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        items: { include: { product: true } },
        customer: { select: { contactName: true, companyName: true } },
      },
      orderBy: { version: 'asc' },
    });

    // Merge raw versioning columns
    const rawRows = await prisma.$queryRawUnsafe(
      `SELECT id, versionLabel, isLatest, parentId, originalDate
       FROM quotations WHERE id IN (${ids.map(() => '?').join(',')})`,
      ...ids
    );
    const rawMap = Object.fromEntries(rawRows.map(r => [r.id, r]));

    const enriched = quotations.map(q => ({
      ...q,
      versionLabel: rawMap[q.id]?.versionLabel || 'A',
      isLatest:     rawMap[q.id]?.isLatest === 1,
      parentId:     rawMap[q.id]?.parentId || null,
      originalDate: rawMap[q.id]?.originalDate || q.quotationDate,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

