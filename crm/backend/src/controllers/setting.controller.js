const { eq } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');
const { inArray, sql, and, gte, lt, like } = require('drizzle-orm');

exports.getSettings = async (req, res) => {
  try {
    const settingsList = await db.select().from(schema.settings);
    res.json({ success: true, data: settingsList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const existing = await db.select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .limit(1);

    let setting;
    if (existing.length > 0) {
      await db.update(schema.settings)
        .set({ value, description, updatedAt: new Date() })
        .where(eq(schema.settings.key, key));
        
      setting = { 
        ...existing[0], 
        value, 
        description, 
        updatedAt: new Date() 
      };
    } else {
      const id = randomUUID();
      const newSetting = {
        id,
        key,
        value,
        description: description || null,
        category: 'GENERAL',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(schema.settings).values(newSetting);
      setting = newSetting;
    }

    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Shared helper: compute current period key and date range ─────────────────
const getInvPeriodInfo = (format, customYearStr) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStartYear = month >= 4 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  const fyString = `${String(fyStartYear).slice(-2)}-${String(fyEndYear).slice(-2)}`;
  const fyStartDate = new Date(fyStartYear, 3, 1);
  const fyEndDate = new Date(fyEndYear, 3, 1);

  let dateStr = '';
  if (format === 'FY_YY_YY') dateStr = fyString;
  else if (format === 'YYYY') dateStr = String(year);
  else if (format === 'YYYYMM') dateStr = `${year}${String(month).padStart(2, '0')}`;
  else if (format === 'CUSTOM') dateStr = customYearStr;

  const periodKey = dateStr || 'ALL';

  const conditions = [];
  if (format === 'FY_YY_YY') {
    conditions.push(gte(schema.sales.createdAt, fyStartDate), lt(schema.sales.createdAt, fyEndDate));
  } else if (format === 'YYYY') {
    conditions.push(gte(schema.sales.createdAt, new Date(year, 0, 1)), lt(schema.sales.createdAt, new Date(year + 1, 0, 1)));
  } else if (format === 'YYYYMM') {
    conditions.push(gte(schema.sales.createdAt, new Date(year, month - 1, 1)), lt(schema.sales.createdAt, new Date(year, month, 1)));
  } else if (format === 'CUSTOM') {
    conditions.push(like(schema.sales.saleNumber, `%/${customYearStr}/%`));
  }

  return { dateStr, periodKey, conditions };
};

// ── GET /api/settings/invoice-counter ────────────────────────────────────────
exports.getInvoiceCounter = async (req, res) => {
  try {
    const settingsList = await db.select()
      .from(schema.settings)
      .where(inArray(schema.settings.key, ['INV_PREFIX', 'INV_DATE_FORMAT', 'INV_CUSTOM_YEAR', 'INV_COUNTER_OFFSET']));
    const getSetting = (k, def) => settingsList.find(s => s.key === k)?.value || def;

    const prefix = getSetting('INV_PREFIX', 'INV');
    const format = getSetting('INV_DATE_FORMAT', 'FY_YY_YY');
    const customYearStr = getSetting('INV_CUSTOM_YEAR', '25-26');

    const { dateStr, periodKey, conditions } = getInvPeriodInfo(format, customYearStr);

    // Parse period-scoped offset — only valid when period matches
    let counterOffset = 0;
    let offsetActive = false;
    try {
      const raw = getSetting('INV_COUNTER_OFFSET', null);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.period === periodKey) {
          counterOffset = parseInt(parsed.offset) || 0;
          offsetActive = true;
        }
        // else: offset from a different period → expired → 0
      }
    } catch { counterOffset = 0; }

    const countResult = await db.select({ count: sql`count(*)` })
      .from(schema.sales)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const currentCount = Number(countResult[0]?.count || 0);

    const middlePart = dateStr ? `/${dateStr}` : '';
    const nextNumber = `${prefix}${middlePart}/${String(currentCount + counterOffset + 1).padStart(3, '0')}`;

    res.json({
      success: true,
      data: {
        currentCount,
        counterOffset,
        offsetActive,   // false when offset belongs to an old period
        currentPeriod: periodKey,
        nextNumber,
        prefix,
        dateStr,
        format,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PUT /api/settings/invoice-counter ────────────────────────────────────────
// Stores offset tagged with current period: { period: "26-27", offset: 4 }
// The offset automatically expires when FY/year/month rolls over.
exports.setInvoiceCounter = async (req, res) => {
  try {
    const { nextValue } = req.body;
    if (typeof nextValue !== 'number' || nextValue < 1) {
      return res.status(400).json({ success: false, message: 'nextValue must be a positive integer' });
    }

    const settingsList = await db.select()
      .from(schema.settings)
      .where(inArray(schema.settings.key, ['INV_PREFIX', 'INV_DATE_FORMAT', 'INV_CUSTOM_YEAR']));
    const getSetting = (k, def) => settingsList.find(s => s.key === k)?.value || def;

    const prefix = getSetting('INV_PREFIX', 'INV');
    const format = getSetting('INV_DATE_FORMAT', 'FY_YY_YY');
    const customYearStr = getSetting('INV_CUSTOM_YEAR', '25-26');

    const { dateStr, periodKey, conditions } = getInvPeriodInfo(format, customYearStr);

    const countResult = await db.select({ count: sql`count(*)` })
      .from(schema.sales)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const currentCount = Number(countResult[0]?.count || 0);

    // offset = nextValue - currentCount - 1
    // Ensures: currentCount + offset + 1 = nextValue
    const newOffset = nextValue - currentCount - 1;

    // Store as period-scoped JSON so it auto-expires next period
    const offsetPayload = JSON.stringify({ period: periodKey, offset: newOffset });

    const existing = await db.select().from(schema.settings)
      .where(eq(schema.settings.key, 'INV_COUNTER_OFFSET')).limit(1);

    if (existing.length > 0) {
      await db.update(schema.settings)
        .set({ value: offsetPayload, updatedAt: new Date() })
        .where(eq(schema.settings.key, 'INV_COUNTER_OFFSET'));
    } else {
      await db.insert(schema.settings).values({
        id: randomUUID(),
        key: 'INV_COUNTER_OFFSET',
        value: offsetPayload,
        description: 'Invoice counter offset (period-scoped JSON). Auto-expires each new FY/year/month.',
        category: 'INVOICE',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const middlePart = dateStr ? `/${dateStr}` : '';
    const nextPreview = `${prefix}${middlePart}/${String(nextValue).padStart(3, '0')}`;

    res.json({
      success: true,
      data: {
        nextValue,
        currentCount,
        newOffset,
        currentPeriod: periodKey,
        nextPreview,
        message: `Next invoice for ${periodKey} will be ${nextPreview}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
