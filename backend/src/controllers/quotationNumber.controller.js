const { eq, and, or, inArray, sql } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');
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

const RESERVATION_TTL_MINUTES = 20;

// ─── Formatting Helpers ────────────────────────────────────────────────────────
const getFormatSettings = async () => {
  const rows = await db.select()
    .from(schema.settings)
    .where(inArray(schema.settings.key, ['QTN_COMPANY_CODE', 'QTN_DATE_FORMAT', 'QTN_PRODUCT_CODES']));
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
  return `${d}${m}${y2}`; // MMDDYY
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
    const rows = await db.select({
      id: schema.quotationCounters.id,
      productCode: schema.quotationCounters.productCode,
      counter: schema.quotationCounters.counter,
      updatedAt: schema.quotationCounters.updatedAt
    })
    .from(schema.quotationCounters)
    .orderBy(schema.quotationCounters.productCode);
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

    // Check if the number that would be generated already exists in quotations.
    // If it does, fast-forward the counter past all existing records.
    const settings = await getFormatSettings();
    const companyCode = settings.QTN_COMPANY_CODE || 'KVB';
    const dateFormat = settings.QTN_DATE_FORMAT || 'DDMMYY';
    const dateStr = formatDateBySetting(new Date(), dateFormat);

    let effectiveCounter = counter;
    let bumped = false;
    const MAX_RETRIES = 500;
    for (let i = 0; i < MAX_RETRIES; i++) {
      const candidate = buildQuotationNumber(companyCode, productCode, effectiveCounter + 1, 'A', dateStr);
      const [existing] = await db.select({ id: schema.quotations.id })
        .from(schema.quotations)
        .where(eq(schema.quotations.quotationNumber, candidate))
        .limit(1);
      if (!existing) break; // candidate is free
      effectiveCounter += 1;
      bumped = true;
    }

    const id = randomUUID();
    // Upsert using INSERT ... ON DUPLICATE KEY UPDATE
    await db.execute(sql`
      INSERT INTO quotation_counters (id, productCode, counter, updatedAt)
      VALUES (${id}, ${productCode}, ${effectiveCounter}, NOW())
      ON DUPLICATE KEY UPDATE counter = ${effectiveCounter}, updatedAt = NOW()
    `);

    const [updated] = await db.select({
      id: schema.quotationCounters.id,
      productCode: schema.quotationCounters.productCode,
      counter: schema.quotationCounters.counter,
      updatedAt: schema.quotationCounters.updatedAt
    })
    .from(schema.quotationCounters)
    .where(eq(schema.quotationCounters.productCode, productCode))
    .limit(1);

    const nextPreview = buildQuotationNumber(companyCode, productCode, effectiveCounter + 1, 'A', dateStr);

    res.json({
      success: true,
      data: updated,
      effectiveCounter,
      nextPreview,
      warning: bumped
        ? `Counter was advanced from ${counter} to ${effectiveCounter} because numbers up to ${counter} already exist in the database. Next quotation will be: ${nextPreview}`
        : null,
    });
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
    await db.delete(schema.quotationReservations)
      .where(and(
        eq(schema.quotationReservations.productCode, productCode),
        sql`expiresAt < ${now}`
      ));

    // Check if user already has an active reservation for this product
    const existing = await db.select({
      id: schema.quotationReservations.id,
      quotationNumber: schema.quotationReservations.quotationNumber,
      expiresAt: schema.quotationReservations.expiresAt
    })
    .from(schema.quotationReservations)
    .where(and(
      eq(schema.quotationReservations.productCode, productCode),
      eq(schema.quotationReservations.reservedBy, userId),
      sql`expiresAt > ${now}`
    ))
    .limit(1);

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
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO quotation_counters (id, productCode, counter, updatedAt)
      VALUES (${id}, ${productCode}, 1, NOW())
      ON DUPLICATE KEY UPDATE counter = counter + 1, updatedAt = NOW()
    `);

    const [counterRow] = await db.select({ counter: schema.quotationCounters.counter })
      .from(schema.quotationCounters)
      .where(eq(schema.quotationCounters.productCode, productCode))
      .limit(1);

    let newCounter = Number(counterRow?.counter || 1);
    const dateStr = formatDateBySetting(now, dateFormat);
    let quotationNumber = buildQuotationNumber(companyCode, productCode, newCounter, 'A', dateStr);

    // ── Collision guard ───────────────────────────────────────────────────────
    // If the counter was reset to a lower value, the generated number might
    // already exist in quotations or active reservations. Keep bumping until
    // we find a number that hasn't been used yet.
    const MAX_RETRIES = 500;
    let retries = 0;
    while (retries < MAX_RETRIES) {
      const [existingQtn] = await db.select({ id: schema.quotations.id })
        .from(schema.quotations)
        .where(eq(schema.quotations.quotationNumber, quotationNumber))
        .limit(1);

      const [existingRes] = await db.select({ id: schema.quotationReservations.id })
        .from(schema.quotationReservations)
        .where(and(
          eq(schema.quotationReservations.quotationNumber, quotationNumber),
          sql`expiresAt > ${now}`
        ))
        .limit(1);

      if (!existingQtn && !existingRes) break; // number is free ✓

      // This number is taken — advance the counter by one more
      newCounter += 1;
      quotationNumber = buildQuotationNumber(companyCode, productCode, newCounter, 'A', dateStr);
      retries++;
    }

    // Persist the final (possibly bumped) counter so future reservations
    // start from the right place
    await db.execute(sql`
      UPDATE quotation_counters
      SET counter = ${newCounter}, updatedAt = NOW()
      WHERE productCode = ${productCode}
    `);
    // ─────────────────────────────────────────────────────────────────────────

    const resId = randomUUID();
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    await db.insert(schema.quotationReservations).values({
      id: resId,
      productCode,
      quotationNumber,
      reservedBy: userId,
      expiresAt,
      createdAt: now
    });

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

    const rows = await db.select({
      id: schema.quotationReservations.id,
      productCode: schema.quotationReservations.productCode
    })
    .from(schema.quotationReservations)
    .where(and(
      eq(schema.quotationReservations.id, id),
      eq(schema.quotationReservations.reservedBy, userId)
    ))
    .limit(1);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    const { productCode } = rows[0];
    await db.delete(schema.quotationReservations).where(eq(schema.quotationReservations.id, id));
    // Decrement counter back (number is released)
    await db.execute(sql`
      UPDATE quotation_counters 
      SET counter = GREATEST(CAST(counter AS SIGNED) - 1, 0) 
      WHERE productCode = ${productCode}
    `);

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
