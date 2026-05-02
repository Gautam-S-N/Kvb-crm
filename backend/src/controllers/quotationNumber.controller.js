/**
 * quotationNumber.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses raw SQL (prisma.$queryRawUnsafe / $executeRawUnsafe) so that the new
 * tables (quotation_counters, quotation_reservations) work WITHOUT needing to
 * regenerate the Prisma client.
 */
const prisma = require('../utils/db');
const { v4: uuidv4 } = require('uuid');
const {
  createRevision,
  getNextRevisionMeta,
  getVersionChain
} = require('../services/quotation.version.service');

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

    // Delegate entirely to the version service.
    // The service pre-populates all fields from the latest version, so any
    // field the frontend doesn't send is preserved from the previous revision.
    const newVersion = await createRevision(id, req.body, req.user.id);

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'QUOTATIONS' });
    }

    res.status(201).json({ success: true, data: newVersion });
  } catch (error) {
    const status = error.message.includes('already exists') ? 409 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quotations/:id/next-revision
// ─────────────────────────────────────────────────────────────────────────────
exports.getNextRevisionInfo = async (req, res) => {
  try {
    const { newVersionLabel, newQuotationNumber } = await getNextRevisionMeta(req.params.id);
    res.json({ success: true, data: { quotationNumber: newQuotationNumber, versionLabel: newVersionLabel } });
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quotations/:id/versions
// ─────────────────────────────────────────────────────────────────────────────
exports.getVersionHistory = async (req, res) => {
  try {
    const chain = await getVersionChain(req.params.id);
    res.json({ success: true, data: chain });
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

