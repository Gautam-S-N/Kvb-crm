/**
 * quotation.version.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all quotation versioning logic.
 *
 * WHY THIS EXISTS:
 *   The versioning columns (versionLabel, isLatest, parentId, originalDate) are
 *   managed via raw SQL because they were added to the DB after the Prisma client
 *   was last generated. This service centralises ALL raw SQL calls for versioning
 *   so that:
 *     1. Controllers stay clean — no raw SQL scattered across files.
 *     2. When the Prisma client is eventually regenerated, only this file needs
 *        updating, not every controller.
 *     3. Validation (version letter continuity, duplicate detection) runs in one place.
 *
 * VALIDATION RULES ENFORCED:
 *   - Version letters must follow A → B → C order (no skipping, e.g. A → C is blocked).
 *   - Duplicate version letters on the same quotation root are rejected.
 *   - A new revision pre-populates ALL fields from the latest version so no data
 *     is lost if the frontend forgets to send a field.
 */

const prisma = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts a 0-based integer to a version letter (0→A, 1→B, 25→Z) */
const versionToLabel = (n) => String.fromCharCode(65 + n);

/** Converts a version letter back to its 0-based index (A→0, B→1) */
const labelToVersion = (label) => label.charCodeAt(0) - 65;

/**
 * Rebuilds a quotation number string by swapping its version letter segment.
 * Supports both structured format (QTN.KVB.STD.005.A.DDMMYY) and legacy (Q-00024 or Q-00024-B).
 */
const rebuildQuotationNumber = (original, newLabel) => {
  if (original.startsWith('QTN.')) {
    const parts = original.split('.');
    if (parts.length >= 5) {
      parts[4] = newLabel;
      return parts.join('.');
    }
  }
  // Legacy format
  if (/-[A-Z]$/.test(original)) {
    return original.slice(0, -1) + newLabel;
  }
  return original + '-' + newLabel;
};

// ── Core Service Methods ──────────────────────────────────────────────────────

/**
 * Resolves the root quotation ID for any quotation (the first version in the chain).
 * If the quotation IS the root (no parentId), returns its own ID.
 *
 * @param {string} quotationId
 * @returns {Promise<string>} rootId
 */
const getRootId = async (quotationId) => {
  const [row] = await prisma.$queryRawUnsafe(
    'SELECT parentId FROM quotations WHERE id = ?',
    quotationId
  );
  if (!row) throw new Error(`Quotation ${quotationId} not found in DB`);
  return row.parentId || quotationId;
};

/**
 * Returns the full version chain for a quotation (all versions, oldest first).
 * Merges Prisma ORM data with raw versioning columns.
 *
 * @param {string} quotationId - Any version in the chain
 * @returns {Promise<Array>} Enriched quotation objects ordered by version ASC
 */
const getVersionChain = async (quotationId) => {
  const rootId = await getRootId(quotationId);

  const versionIds = await prisma.$queryRawUnsafe(
    'SELECT id FROM quotations WHERE id = ? OR parentId = ? ORDER BY version ASC',
    rootId, rootId
  );
  const ids = versionIds.map(r => r.id);
  if (!ids.length) return [];

  const quotations = await prisma.quotation.findMany({
    where: { id: { in: ids } },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      items: { include: { product: true } },
      customer: { select: { contactName: true, companyName: true } },
    },
    orderBy: { version: 'asc' },
  });

  const rawRows = await prisma.$queryRawUnsafe(
    `SELECT id, versionLabel, isLatest, parentId, originalDate
     FROM quotations WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids
  );
  const rawMap = Object.fromEntries(rawRows.map(r => [r.id, r]));

  return quotations.map(q => ({
    ...q,
    versionLabel:  rawMap[q.id]?.versionLabel || 'A',
    isLatest:      rawMap[q.id]?.isLatest === 1,
    parentId:      rawMap[q.id]?.parentId || null,
    originalDate:  rawMap[q.id]?.originalDate || q.quotationDate,
  }));
};

/**
 * Returns metadata about the NEXT revision that would be created.
 * Used to pre-populate the revision form on the frontend.
 *
 * @param {string} quotationId - The quotation to be revised
 * @returns {Promise<{ rootId, newVersionLabel, newQuotationNumber, currentVersion }>}
 */
const getNextRevisionMeta = async (quotationId) => {
  const original = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!original) throw new Error('Quotation not found');

  const rootId = await getRootId(quotationId);

  const [countRow] = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*) AS cnt FROM quotations WHERE id = ? OR parentId = ?',
    rootId, rootId
  );
  const versionCount = Number(countRow.cnt);
  const newVersionLabel = versionToLabel(versionCount); // 0→A, 1→B, 2→C

  // Validate: check for duplicate version label
  const existing = await prisma.$queryRawUnsafe(
    'SELECT id FROM quotations WHERE (id = ? OR parentId = ?) AND versionLabel = ?',
    rootId, rootId, newVersionLabel
  );
  if (existing.length > 0) {
    throw new Error(`Version "${newVersionLabel}" already exists for this quotation`);
  }

  const newQuotationNumber = rebuildQuotationNumber(original.quotationNumber, newVersionLabel);

  return { rootId, newVersionLabel, newQuotationNumber, currentVersion: versionCount, original };
};

/**
 * Creates a new revision of a quotation.
 *
 * DATA SAFETY: All fields are pre-populated from the LATEST version of the
 * quotation, then overridden with any fields provided by the caller. This ensures
 * no data is lost if the caller omits a field.
 *
 * @param {string} quotationId       - The quotation being revised
 * @param {object} overrides         - Fields that are changing in this revision
 * @param {string} performedByUserId - User creating the revision
 * @returns {Promise<object>} The newly created revision (enriched with version fields)
 */
const createRevision = async (quotationId, overrides, performedByUserId) => {
  // Fetch the latest version to use as the base (prevents data loss)
  const chain = await getVersionChain(quotationId);
  if (!chain.length) throw new Error('No version chain found for this quotation');

  const latest = chain[chain.length - 1]; // Latest = last in ASC order
  const { rootId, newVersionLabel, newQuotationNumber, currentVersion } = await getNextRevisionMeta(quotationId);

  // Merge: start from latest version, apply caller's overrides
  const {
    items = latest.items.map(i => ({
      productId:   i.productId,
      description: i.description,
      quantity:    i.quantity,
      unitPrice:   Number(i.unitPrice),
      discount:    Number(i.discount),
      taxRate:     Number(i.taxRate),
      totalPrice:  Number(i.totalPrice),
    })),
    customFields    = latest.customFields,
    paymentTerms    = latest.paymentTerms,
    deliveryTerms   = latest.deliveryTerms,
    notes           = latest.notes,
    termsConditions = latest.termsConditions,
    discountAmount  = Number(latest.discountAmount),
    discountPercent = Number(latest.discountPercent),
  } = overrides;

  // Recalculate totals
  let subTotal = 0;
  const quotationItems = items.map(item => {
    const totalPrice = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    subTotal += totalPrice;
    return {
      productId:   item.productId,
      description: item.description || null,
      quantity:    item.quantity,
      unitPrice:   item.unitPrice,
      discount:    item.discount || 0,
      taxRate:     item.taxRate || 18,
      totalPrice,
    };
  });

  const discountAmt = discountAmount || (subTotal * (discountPercent || 0) / 100);
  const taxableAmount = subTotal - discountAmt;
  const gstRate = (customFields && customFields.gstRate != null) ? customFields.gstRate : 18;
  let taxAmount = taxableAmount * (gstRate / 100);
  let totalAmount = taxableAmount + taxAmount;

  // Solar Tunnel Dryer special pricing
  if (latest.templateType === 'SOLAR_TUNNEL_DRYER' && customFields) {
    const cfQty   = parseFloat(customFields.qty) || 1;
    const cfPrice = parseFloat(customFields.unitPrice) || parseFloat(customFields.totalAmt) || 0;
    const cfTotal = cfQty * cfPrice;
    customFields.totalAmt  = cfTotal;
    customFields.unitPrice = cfPrice;
    if (cfTotal > 0) { totalAmount = cfTotal; taxAmount = 0; subTotal = cfTotal; }
  }

  // Mark all previous versions as not latest
  await prisma.$executeRawUnsafe(
    'UPDATE quotations SET isLatest = 0 WHERE id = ? OR parentId = ?',
    rootId, rootId
  );

  // Create the new revision
  const newVersion = await prisma.quotation.create({
    data: {
      quotationNumber:  newQuotationNumber,
      version:          currentVersion + 1,
      status:           'DRAFT',
      leadId:           latest.leadId,
      customerId:       latest.customerId,
      createdById:      performedByUserId,
      subTotal,
      discountAmount:   discountAmt,
      discountPercent:  discountPercent || 0,
      taxAmount,
      totalAmount,
      quotationDate:    new Date(),
      validUntil:       latest.validUntil,
      paymentTerms,
      deliveryTerms,
      notes,
      termsConditions,
      templateType:     latest.templateType,
      customFields:     customFields ? JSON.parse(JSON.stringify(customFields)) : null,
      items:            { create: quotationItems },
    },
    include: {
      items:    { include: { product: true } },
      customer: true,
      lead:     true,
    },
  });

  // Set version metadata via raw SQL
  await prisma.$executeRawUnsafe(
    'UPDATE quotations SET versionLabel = ?, isLatest = 1, parentId = ? WHERE id = ?',
    newVersionLabel, rootId, newVersion.id
  );

  // Add timeline entry
  await prisma.leadTimeline.create({
    data: {
      leadId:      latest.leadId,
      action:      'Quotation Revised',
      description: `Version ${newVersionLabel} created: ${newQuotationNumber}`,
      performedBy: performedByUserId,
    },
  });

  return { ...newVersion, versionLabel: newVersionLabel, parentId: rootId, isLatest: true };
};

module.exports = { getRootId, getVersionChain, getNextRevisionMeta, createRevision, versionToLabel, rebuildQuotationNumber };
