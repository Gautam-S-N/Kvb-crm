const { eq, and, or, sql, inArray, asc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

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
  const [row] = await db.select({ parentId: schema.quotations.parentId })
    .from(schema.quotations)
    .where(eq(schema.quotations.id, quotationId))
    .limit(1);
  if (!row) throw new Error(`Quotation ${quotationId} not found in DB`);
  return row.parentId || quotationId;
};

/**
 * Returns the full version chain for a quotation (all versions, oldest first).
 * Merges ORM data with versioning columns.
 *
 * @param {string} quotationId - Any version in the chain
 * @returns {Promise<Array>} Enriched quotation objects ordered by version ASC
 */
const getVersionChain = async (quotationId) => {
  const rootId = await getRootId(quotationId);

  const versionIds = await db.select({ id: schema.quotations.id })
    .from(schema.quotations)
    .where(or(
      eq(schema.quotations.id, rootId),
      eq(schema.quotations.parentId, rootId)
    ))
    .orderBy(asc(schema.quotations.version));
  
  const ids = versionIds.map(r => r.id);
  if (!ids.length) return [];

  const quotationsRaw = await db.select({
    id: schema.quotations.id,
    quotationNumber: schema.quotations.quotationNumber,
    version: schema.quotations.version,
    status: schema.quotations.status,
    leadId: schema.quotations.leadId,
    customerId: schema.quotations.customerId,
    createdById: schema.quotations.createdById,
    subTotal: schema.quotations.subTotal,
    discountAmount: schema.quotations.discountAmount,
    discountPercent: schema.quotations.discountPercent,
    taxAmount: schema.quotations.taxAmount,
    totalAmount: schema.quotations.totalAmount,
    quotationDate: schema.quotations.quotationDate,
    validUntil: schema.quotations.validUntil,
    paymentTerms: schema.quotations.paymentTerms,
    deliveryTerms: schema.quotations.deliveryTerms,
    notes: schema.quotations.notes,
    termsConditions: schema.quotations.termsConditions,
    templateType: schema.quotations.templateType,
    customFields: schema.quotations.customFields,
    versionLabel: schema.quotations.versionLabel,
    isLatest: schema.quotations.isLatest,
    parentId: schema.quotations.parentId,
    originalDate: schema.quotations.originalDate,
    createdByFirstName: schema.users.firstName,
    createdByLastName: schema.users.lastName,
    customerContactName: schema.customers.contactName,
    customerCompanyName: schema.customers.companyName
  })
  .from(schema.quotations)
  .leftJoin(schema.users, eq(schema.quotations.createdById, schema.users.id))
  .leftJoin(schema.customers, eq(schema.quotations.customerId, schema.customers.id))
  .where(inArray(schema.quotations.id, ids))
  .orderBy(asc(schema.quotations.version));

  const quotations = quotationsRaw.map(q => ({
    id: q.id,
    quotationNumber: q.quotationNumber,
    version: q.version,
    status: q.status,
    leadId: q.leadId,
    customerId: q.customerId,
    createdById: q.createdById,
    subTotal: q.subTotal,
    discountAmount: q.discountAmount,
    discountPercent: q.discountPercent,
    taxAmount: q.taxAmount,
    totalAmount: q.totalAmount,
    quotationDate: q.quotationDate,
    validUntil: q.validUntil,
    paymentTerms: q.paymentTerms,
    deliveryTerms: q.deliveryTerms,
    notes: q.notes,
    termsConditions: q.termsConditions,
    templateType: q.templateType,
    customFields: q.customFields,
    versionLabel: q.versionLabel,
    isLatest: q.isLatest,
    parentId: q.parentId,
    originalDate: q.originalDate,
    createdBy: q.createdByFirstName ? {
      firstName: q.createdByFirstName,
      lastName: q.createdByLastName
    } : null,
    customer: q.customerContactName ? {
      contactName: q.customerContactName,
      companyName: q.customerCompanyName
    } : null
  }));

  // Fetch items
  const itemsRaw = await db.select({
    id: schema.quotationItems.id,
    quotationId: schema.quotationItems.quotationId,
    productId: schema.quotationItems.productId,
    description: schema.quotationItems.description,
    quantity: schema.quotationItems.quantity,
    unitPrice: schema.quotationItems.unitPrice,
    discount: schema.quotationItems.discount,
    taxRate: schema.quotationItems.taxRate,
    totalPrice: schema.quotationItems.totalPrice,
    productId_: schema.products.id,
    productName: schema.products.name,
    productSku: schema.products.sku,
    productUnitOfMeasure: schema.products.unitOfMeasure,
    productHsnCode: schema.products.hsnCode,
    productDescription: schema.products.description
  })
  .from(schema.quotationItems)
  .leftJoin(schema.products, eq(schema.quotationItems.productId, schema.products.id))
  .where(inArray(schema.quotationItems.quotationId, ids));

  const items = itemsRaw.map(i => ({
    id: i.id,
    quotationId: i.quotationId,
    productId: i.productId,
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: i.discount,
    taxRate: i.taxRate,
    totalPrice: i.totalPrice,
    product: i.productId_ ? {
      id: i.productId_,
      name: i.productName,
      sku: i.productSku,
      unitOfMeasure: i.productUnitOfMeasure,
      hsnCode: i.productHsnCode,
      description: i.productDescription
    } : null
  }));

  const itemsMap = {};
  for (const item of items) {
    if (!itemsMap[item.quotationId]) itemsMap[item.quotationId] = [];
    itemsMap[item.quotationId].push(item);
  }

  return quotations.map(q => ({
    ...q,
    createdBy: q.createdBy?.firstName ? q.createdBy : null,
    customer: q.customer?.contactName ? q.customer : null,
    isLatest: q.isLatest === 1 || q.isLatest === true,
    originalDate: q.originalDate || q.quotationDate,
    items: itemsMap[q.id] || []
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
  const originalList = await db.select().from(schema.quotations).where(eq(schema.quotations.id, quotationId)).limit(1);
  const original = originalList[0];
  if (!original) throw new Error('Quotation not found');

  const rootId = await getRootId(quotationId);

  const [countRow] = await db.select({ cnt: sql`COUNT(*)` })
    .from(schema.quotations)
    .where(or(
      eq(schema.quotations.id, rootId),
      eq(schema.quotations.parentId, rootId)
    ));
  const versionCount = Number(countRow.cnt);
  const newVersionLabel = versionToLabel(versionCount); // 0→A, 1→B, 2→C

  // Validate: check for duplicate version label
  const existing = await db.select({ id: schema.quotations.id })
    .from(schema.quotations)
    .where(and(
      or(
        eq(schema.quotations.id, rootId),
        eq(schema.quotations.parentId, rootId)
      ),
      eq(schema.quotations.versionLabel, newVersionLabel)
    ))
    .limit(1);

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
 * quotation, then overridden with any fields provided by the caller.
 *
 * @param {string} quotationId       - The quotation being revised
 * @param {object} overrides         - Fields that are changing in this revision
 * @param {string} performedByUserId - User creating the revision
 * @returns {Promise<object>} The newly created revision (enriched with version fields)
 */
const createRevision = async (quotationId, overrides, performedByUserId) => {
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
  const itemsToInsert = items.map(item => {
    const totalPrice = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    subTotal += totalPrice;
    return {
      id: randomUUID(),
      productId:   item.productId,
      description: item.description || null,
      quantity:    item.quantity,
      unitPrice:   String(item.unitPrice),
      discount:    String(item.discount || 0),
      taxRate:     String(item.taxRate || 18),
      totalPrice:  String(totalPrice),
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

  const newVersionId = randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    // Mark all previous versions as not latest
    await tx.update(schema.quotations)
      .set({ isLatest: false })
      .where(or(
        eq(schema.quotations.id, rootId),
        eq(schema.quotations.parentId, rootId)
      ));

    // Create the new revision
    await tx.insert(schema.quotations).values({
      id: newVersionId,
      quotationNumber: newQuotationNumber,
      version: currentVersion + 1,
      status: 'DRAFT',
      leadId: latest.leadId,
      customerId: latest.customerId,
      createdById: performedByUserId,
      subTotal: String(subTotal),
      discountAmount: String(discountAmt),
      discountPercent: String(discountPercent || 0),
      taxAmount: String(taxAmount),
      totalAmount: String(totalAmount),
      quotationDate: now,
      validUntil: latest.validUntil ? new Date(latest.validUntil) : null,
      paymentTerms: paymentTerms || null,
      deliveryTerms: deliveryTerms || null,
      notes: notes || null,
      termsConditions: termsConditions || null,
      templateType: latest.templateType,
      customFields: customFields != null ? (typeof customFields === 'string' ? JSON.parse(customFields) : customFields) : undefined,
      versionLabel: newVersionLabel,
      isLatest: true,
      parentId: rootId,
      originalDate: latest.originalDate ? new Date(latest.originalDate) : null,
      createdAt: now,
      updatedAt: now
    });

    const itemsWithQuoteId = itemsToInsert.map(i => ({
      ...i,
      quotationId: newVersionId
    }));
    if (itemsWithQuoteId.length > 0) {
      await tx.insert(schema.quotationItems).values(itemsWithQuoteId);
    }

    // Add timeline entry
    await tx.insert(schema.leadTimeline).values({
      id: randomUUID(),
      leadId: latest.leadId,
      action: 'Quotation Revised',
      description: `Version ${newVersionLabel} created: ${newQuotationNumber}`,
      performedBy: performedByUserId,
      createdAt: now
    });
  });

  // Return the fully enriched newly created version
  const createdRawList = await db.select({
    id: schema.quotations.id,
    quotationNumber: schema.quotations.quotationNumber,
    version: schema.quotations.version,
    status: schema.quotations.status,
    leadId: schema.quotations.leadId,
    customerId: schema.quotations.customerId,
    createdById: schema.quotations.createdById,
    subTotal: schema.quotations.subTotal,
    discountAmount: schema.quotations.discountAmount,
    discountPercent: schema.quotations.discountPercent,
    taxAmount: schema.quotations.taxAmount,
    totalAmount: schema.quotations.totalAmount,
    quotationDate: schema.quotations.quotationDate,
    validUntil: schema.quotations.validUntil,
    paymentTerms: schema.quotations.paymentTerms,
    deliveryTerms: schema.quotations.deliveryTerms,
    notes: schema.quotations.notes,
    termsConditions: schema.quotations.termsConditions,
    templateType: schema.quotations.templateType,
    customFields: schema.quotations.customFields,
    versionLabel: schema.quotations.versionLabel,
    isLatest: schema.quotations.isLatest,
    parentId: schema.quotations.parentId,
    originalDate: schema.quotations.originalDate,
    customerId_: schema.customers.id,
    customerContactName: schema.customers.contactName,
    customerCompanyName: schema.customers.companyName,
    leadId_: schema.leads.id,
    leadNumber: schema.leads.leadNumber,
    leadTitle: schema.leads.title
  })
  .from(schema.quotations)
  .leftJoin(schema.customers, eq(schema.quotations.customerId, schema.customers.id))
  .leftJoin(schema.leads, eq(schema.quotations.leadId, schema.leads.id))
  .where(eq(schema.quotations.id, newVersionId))
  .limit(1);

  if (createdRawList.length === 0) {
    throw new Error('Revised quotation not found');
  }

  const rawCreated = createdRawList[0];
  const created = {
    id: rawCreated.id,
    quotationNumber: rawCreated.quotationNumber,
    version: rawCreated.version,
    status: rawCreated.status,
    leadId: rawCreated.leadId,
    customerId: rawCreated.customerId,
    createdById: rawCreated.createdById,
    subTotal: rawCreated.subTotal,
    discountAmount: rawCreated.discountAmount,
    discountPercent: rawCreated.discountPercent,
    taxAmount: rawCreated.taxAmount,
    totalAmount: rawCreated.totalAmount,
    quotationDate: rawCreated.quotationDate,
    validUntil: rawCreated.validUntil,
    paymentTerms: rawCreated.paymentTerms,
    deliveryTerms: rawCreated.deliveryTerms,
    notes: rawCreated.notes,
    termsConditions: rawCreated.termsConditions,
    templateType: rawCreated.templateType,
    customFields: rawCreated.customFields,
    versionLabel: rawCreated.versionLabel,
    isLatest: rawCreated.isLatest,
    parentId: rawCreated.parentId,
    originalDate: rawCreated.originalDate,
    customer: rawCreated.customerId_ ? {
      id: rawCreated.customerId_,
      contactName: rawCreated.customerContactName,
      companyName: rawCreated.customerCompanyName
    } : null,
    lead: rawCreated.leadId_ ? {
      id: rawCreated.leadId_,
      leadNumber: rawCreated.leadNumber,
      title: rawCreated.leadTitle
    } : null
  };

  const finalItemsRaw = await db.select({
    id: schema.quotationItems.id,
    quotationId: schema.quotationItems.quotationId,
    productId: schema.quotationItems.productId,
    description: schema.quotationItems.description,
    quantity: schema.quotationItems.quantity,
    unitPrice: schema.quotationItems.unitPrice,
    discount: schema.quotationItems.discount,
    taxRate: schema.quotationItems.taxRate,
    totalPrice: schema.quotationItems.totalPrice,
    productId_: schema.products.id,
    productName: schema.products.name,
    productSku: schema.products.sku,
    productUnitOfMeasure: schema.products.unitOfMeasure,
    productHsnCode: schema.products.hsnCode,
    productDescription: schema.products.description
  })
  .from(schema.quotationItems)
  .leftJoin(schema.products, eq(schema.quotationItems.productId, schema.products.id))
  .where(eq(schema.quotationItems.quotationId, newVersionId));

  created.items = finalItemsRaw.map(i => ({
    id: i.id,
    quotationId: i.quotationId,
    productId: i.productId,
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: i.discount,
    taxRate: i.taxRate,
    totalPrice: i.totalPrice,
    product: i.productId_ ? {
      id: i.productId_,
      name: i.productName,
      sku: i.productSku,
      unitOfMeasure: i.productUnitOfMeasure,
      hsnCode: i.productHsnCode,
      description: i.productDescription
    } : null
  }));

  created.isLatest = true;
  return created;
};

module.exports = { getRootId, getVersionChain, getNextRevisionMeta, createRevision, versionToLabel, rebuildQuotationNumber };
