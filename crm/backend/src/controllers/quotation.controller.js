const { eq, and, or, like, inArray, sql, desc, asc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { numberToWords } = require('../utils/numberToWords');
const { triggerRefreshForEmployee } = require('../services/achievement.service');

// Product code map for structured quotation numbers
const PRODUCT_CODE_MAP = {
  'SOLAR_TUNNEL_DRYER': 'STD',
  'SOLAR_PARABOLIC_TROUGH': 'PTC',
  'SOLAR_PARABOLIC_COOKER': 'SPC',
  'SCHEFFLER_DISH': 'SSD',
  'STANDARD': 'STD',
};

const formatDateDDMMYY = (date = new Date()) => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${d}${m}${y}`;
};

// Generate structured quotation number via counter
const generateQuotationNumber = async (templateType = 'STANDARD') => {
  const productCode = PRODUCT_CODE_MAP[templateType] || 'STD';
  const id = randomUUID();
  // Atomically increment
  await db.execute(sql`
    INSERT INTO quotation_counters (id, productCode, counter, updatedAt)
    VALUES (${id}, ${productCode}, 1, NOW())
    ON DUPLICATE KEY UPDATE counter = counter + 1, updatedAt = NOW()
  `);
  const [row] = await db.select({ counter: schema.quotationCounters.counter })
    .from(schema.quotationCounters)
    .where(eq(schema.quotationCounters.productCode, productCode))
    .limit(1);
  const dateStr = formatDateDDMMYY();
  return `QTN.KVB.${productCode}.${String(Number(row?.counter || 1)).padStart(3, '0')}.A.${dateStr}`;
};

// Load company logo as Base64 (embedded in PDF)
const getLogoBase64 = () => {
  const exts = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
  const assetsDir = path.join(__dirname, '../assets');
  for (const ext of exts) {
    const logoPath = path.join(assetsDir, `logo.${ext}`);
    if (fs.existsSync(logoPath)) {
      const data = fs.readFileSync(logoPath);
      const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' };
      return `data:${mimeMap[ext]};base64,${data.toString('base64')}`;
    }
  }
  return null;
};

// Get all quotations
exports.getQuotations = async (req, res) => {
  try {
    const { leadId, status, search, page = 1, limit = 100 } = req.query;
    const conditions = [];

    if (leadId) conditions.push(eq(schema.quotations.leadId, leadId));
    if (status) conditions.push(eq(schema.quotations.status, status));
    // Role-based filter
    if (req.user.role === 'EMPLOYEE') {
      conditions.push(eq(schema.quotations.createdById, req.user.id));
    }

    // Allow searching by quotation number or customer info
    if (search) {
      conditions.push(
        or(
          like(schema.quotations.quotationNumber, `%${search}%`),
          like(schema.customers.contactName, `%${search}%`),
          like(schema.customers.companyName, `%${search}%`)
        )
      );
    }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const totalResult = await db.select({ count: sql`count(*)` })
      .from(schema.quotations)
      .leftJoin(schema.customers, eq(schema.quotations.customerId, schema.customers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = Number(totalResult[0]?.count || 0);

    const quotationsRaw = await db.select({
      id: schema.quotations.id,
      quotationNumber: schema.quotations.quotationNumber,
      version: schema.quotations.version,
      status: schema.quotations.status,
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
      pdfUrl: schema.quotations.pdfUrl,
      templateType: schema.quotations.templateType,
      customFields: schema.quotations.customFields,
      leadId: schema.quotations.leadId,
      customerId: schema.quotations.customerId,
      createdById: schema.quotations.createdById,
      createdAt: schema.quotations.createdAt,
      updatedAt: schema.quotations.updatedAt,
      leadLeadNumber: schema.leads.leadNumber,
      leadTitle: schema.leads.title,
      customerContactName: schema.customers.contactName,
      customerCompanyName: schema.customers.companyName,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.quotations)
    .leftJoin(schema.leads, eq(schema.quotations.leadId, schema.leads.id))
    .leftJoin(schema.customers, eq(schema.quotations.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.quotations.createdById, schema.users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.quotations.createdAt))
    .limit(parsedLimit)
    .offset(skip);

    const quotationsRows = quotationsRaw.map(r => ({
      id: r.id, quotationNumber: r.quotationNumber, version: r.version, status: r.status,
      subTotal: r.subTotal, discountAmount: r.discountAmount, discountPercent: r.discountPercent,
      taxAmount: r.taxAmount, totalAmount: r.totalAmount, quotationDate: r.quotationDate,
      validUntil: r.validUntil, paymentTerms: r.paymentTerms, deliveryTerms: r.deliveryTerms,
      notes: r.notes, termsConditions: r.termsConditions, pdfUrl: r.pdfUrl,
      templateType: r.templateType, customFields: r.customFields,
      leadId: r.leadId, customerId: r.customerId, createdById: r.createdById,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
      lead: r.leadLeadNumber ? { leadNumber: r.leadLeadNumber, title: r.leadTitle } : null,
      customer: r.customerContactName ? { contactName: r.customerContactName, companyName: r.customerCompanyName } : null,
      createdBy: r.createdByFirstName ? { firstName: r.createdByFirstName, lastName: r.createdByLastName } : null
    }));

    // Fetch items counts
    let itemsCountMap = {};
    if (quotationsRows.length > 0) {
      const qIds = quotationsRows.map(q => q.id);
      const counts = await db.select({ quotationId: schema.quotationItems.quotationId, count: sql`count(*)` })
        .from(schema.quotationItems)
        .where(inArray(schema.quotationItems.quotationId, qIds))
        .groupBy(schema.quotationItems.quotationId);
      for (const item of counts) {
        itemsCountMap[item.quotationId] = Number(item.count);
      }
    }

    const formattedQuotations = quotationsRows.map(q => ({
      ...q,
      _count: { items: itemsCountMap[q.id] || 0 }
    }));

    res.json({
      success: true,
      data: formattedQuotations,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single quotation
exports.getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;
    const quotationsList = await db.select({
      id: schema.quotations.id,
      quotationNumber: schema.quotations.quotationNumber,
      version: schema.quotations.version,
      status: schema.quotations.status,
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
      pdfUrl: schema.quotations.pdfUrl,
      templateType: schema.quotations.templateType,
      customFields: schema.quotations.customFields,
      leadId: schema.quotations.leadId,
      customerId: schema.quotations.customerId,
      createdById: schema.quotations.createdById,
      createdAt: schema.quotations.createdAt,
      updatedAt: schema.quotations.updatedAt,
      leadId_: schema.leads.id,
      leadLeadNumber: schema.leads.leadNumber,
      leadTitle: schema.leads.title,
      customerId_: schema.customers.id,
      customerContactName: schema.customers.contactName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      customerCompanyName: schema.customers.companyName,
      customerAddress: schema.customers.address,
      customerCity: schema.customers.city,
      customerState: schema.customers.state,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName,
      createdByEmail: schema.users.email
    })
    .from(schema.quotations)
    .leftJoin(schema.leads, eq(schema.quotations.leadId, schema.leads.id))
    .leftJoin(schema.customers, eq(schema.quotations.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.quotations.createdById, schema.users.id))
    .where(eq(schema.quotations.id, id))
    .limit(1);

    if (quotationsList.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    const rawQ = quotationsList[0];
    const quotation = {
      id: rawQ.id, quotationNumber: rawQ.quotationNumber, version: rawQ.version, status: rawQ.status,
      subTotal: rawQ.subTotal, discountAmount: rawQ.discountAmount, discountPercent: rawQ.discountPercent,
      taxAmount: rawQ.taxAmount, totalAmount: rawQ.totalAmount, quotationDate: rawQ.quotationDate,
      validUntil: rawQ.validUntil, paymentTerms: rawQ.paymentTerms, deliveryTerms: rawQ.deliveryTerms,
      notes: rawQ.notes, termsConditions: rawQ.termsConditions, pdfUrl: rawQ.pdfUrl,
      templateType: rawQ.templateType, customFields: rawQ.customFields,
      leadId: rawQ.leadId, customerId: rawQ.customerId, createdById: rawQ.createdById,
      createdAt: rawQ.createdAt, updatedAt: rawQ.updatedAt,
      lead: rawQ.leadId_ ? { id: rawQ.leadId_, leadNumber: rawQ.leadLeadNumber, title: rawQ.leadTitle } : null,
      customer: rawQ.customerId_ ? { id: rawQ.customerId_, contactName: rawQ.customerContactName, email: rawQ.customerEmail, phone: rawQ.customerPhone, companyName: rawQ.customerCompanyName, address: rawQ.customerAddress, city: rawQ.customerCity, state: rawQ.customerState } : null,
      createdBy: rawQ.createdByEmail ? { firstName: rawQ.createdByFirstName, lastName: rawQ.createdByLastName, email: rawQ.createdByEmail } : null
    };

    // Fetch items with products
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
    .where(eq(schema.quotationItems.quotationId, id));

    const itemsMapped = itemsRaw.map(i => ({
      id: i.id, quotationId: i.quotationId, productId: i.productId, description: i.description,
      quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate, totalPrice: i.totalPrice,
      product: i.productId_ ? { id: i.productId_, name: i.productName, sku: i.productSku, unitOfMeasure: i.productUnitOfMeasure, hsnCode: i.productHsnCode, description: i.productDescription } : null
    }));

    quotation.items = itemsMapped;

    res.json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create quotation
exports.createQuotation = async (req, res) => {
  try {
    const {
      leadId,
      items = [],
      discountAmount,
      discountPercent,
      validUntil,
      paymentTerms,
      deliveryTerms,
      notes,
      termsConditions,
      templateType = 'STANDARD',
      customFields = null,
      reservationId = null,
      quotationNumber: providedNumber = null,
    } = req.body;

    const leadRaw = await db.select({
      id: schema.leads.id,
      customerId: schema.leads.customerId,
      leadNumber: schema.leads.leadNumber,
      title: schema.leads.title,
      leadCustomerContactName: schema.customers.contactName
    })
    .from(schema.leads)
    .leftJoin(schema.customers, eq(schema.leads.customerId, schema.customers.id))
    .where(eq(schema.leads.id, leadId))
    .limit(1);

    const leadRow = leadRaw[0] || null;
    const lead = leadRow ? { ...leadRow, customer: leadRow.leadCustomerContactName ? { contactName: leadRow.leadCustomerContactName } : null } : null;

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Calculate totals
    let subTotal = 0;
    const itemsToInsert = items.map(item => {
      const totalPrice = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      subTotal += totalPrice;
      return {
        id: randomUUID(),
        productId: item.productId,
        description: item.description || null,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        discount: String(item.discount || 0),
        taxRate: String(item.taxRate || 18),
        totalPrice: String(totalPrice)
      };
    });

    const discountAmt = discountAmount || (subTotal * (discountPercent || 0) / 100);
    let taxableAmount = subTotal - discountAmt;
    const gstRate = (customFields && customFields.gstRate != null) ? customFields.gstRate : 18;
    let taxAmount = taxableAmount * (gstRate / 100);
    let totalAmount = taxableAmount + taxAmount;

    if (templateType === 'SOLAR_TUNNEL_DRYER' && customFields) {
      const cfQty = parseFloat(customFields.qty) || 1;
      const cfPrice = parseFloat(customFields.unitPrice) || parseFloat(customFields.totalAmt) || 0;
      const cfTotal = cfQty * cfPrice;

      customFields.totalAmt = cfTotal;
      customFields.unitPrice = cfPrice;

      if (cfTotal > 0) {
        totalAmount = cfTotal;
        taxAmount = 0;
        subTotal = cfTotal;
      }
    }

    let quotationNumber;
    if (providedNumber) {
      quotationNumber = providedNumber;
      if (reservationId) {
        try {
          await db.delete(schema.quotationReservations).where(eq(schema.quotationReservations.id, reservationId));
        } catch (_) {}
      }
    } else {
      quotationNumber = await generateQuotationNumber(templateType);
    }

    const now = new Date();
    const quotationId = randomUUID();

    const quotationData = {
      id: quotationId,
      quotationNumber,
      leadId,
      customerId: lead.customerId,
      createdById: req.user.id,
      subTotal: String(subTotal),
      discountAmount: String(discountAmt),
      discountPercent: String(discountPercent || 0),
      taxAmount: String(taxAmount),
      totalAmount: String(totalAmount),
      quotationDate: now,
      validUntil: validUntil ? new Date(validUntil) : null,
      paymentTerms: paymentTerms || null,
      deliveryTerms: deliveryTerms || null,
      notes: notes || null,
      termsConditions: termsConditions || null,
      templateType,
      customFields: customFields != null ? (typeof customFields === 'string' ? JSON.parse(customFields) : customFields) : undefined,
      createdAt: now,
      updatedAt: now
    };

    const finalQuotation = await db.transaction(async (tx) => {
      await tx.insert(schema.quotations).values(quotationData);

      const itemsWithQuoteId = itemsToInsert.map(i => ({
        ...i,
        quotationId
      }));
      if (itemsWithQuoteId.length > 0) {
        await tx.insert(schema.quotationItems).values(itemsWithQuoteId);
      }

      await tx.update(schema.quotations)
        .set({
          versionLabel: 'A',
          isLatest: true,
          originalDate: now
        })
        .where(eq(schema.quotations.id, quotationId));

      await tx.update(schema.leads)
        .set({ status: 'QUOTATION_SENT', updatedAt: now })
        .where(eq(schema.leads.id, leadId));

      await tx.insert(schema.leadTimeline).values({
        id: randomUUID(),
        leadId,
        action: 'Quotation Created',
        description: `Quotation ${quotationNumber} [${templateType}] created — ₹${totalAmount.toLocaleString()}`,
        performedBy: req.user.id,
        createdAt: now
      });

      return {
        ...quotationData,
        items: itemsWithQuoteId
      };
    });

    const customerObj = await db.select().from(schema.customers).where(eq(schema.customers.id, lead.customerId)).limit(1).then(r => r[0]);
    finalQuotation.customer = customerObj;
    finalQuotation.lead = lead;

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'QUOTATIONS' });
      ioRefresh.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    triggerRefreshForEmployee(req.user.id, ioRefresh);

    res.status(201).json({ success: true, data: finalQuotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function buildStandardHTML(quotation) {
  const logoSrc = getLogoBase64();
  const itemsRows = quotation.items.map((item, i) => {
    const qty = Number(item.quantity);
    const rate = Number(item.unitPrice);
    const disc = Number(item.discount) || 0;
    const itemTaxable = qty * rate * (1 - disc / 100);
    const hsn = item.product?.hsnCode || '';
    const uom = item.product?.unitOfMeasure || 'Nos';

    return `
      <tr>
        <td style="text-align:center;border:1px solid #999;padding:6px 4px;">${i + 1}</td>
        <td style="border:1px solid #999;padding:6px 4px;">
          <strong>${item.product?.name || 'Product'}</strong>
          ${(item.description || item.product?.description) ? `<br/><small style="color:#555">${item.description || item.product.description}</small>` : ''}
        </td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:center;">${hsn}</td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:center;">${qty}</td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:right;">₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:center;">${uom}</td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:right;">₹${itemTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Quotation ${quotation.quotationNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px 32px; }
  .outer-border { border: 2px solid #333; }
  .title-bar { text-align: center; font-size: 16px; font-weight: bold; border-bottom: 2px solid #333; padding: 8px 0; letter-spacing: 2px; text-transform: uppercase; }
  .top-grid { display: grid; grid-template-columns: 55% 45%; border-bottom: 1px solid #777; }
  .company-block { padding: 10px 14px; border-right: 1px solid #777; }
  .company-block .name { font-size: 16px; font-weight: bold; color: #15803d; margin-bottom: 4px; }
  .company-block p { margin-top: 2px; line-height: 1.5; font-size: 11.5px; }
  .meta-block { padding: 0; }
  .meta-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #bbb; }
  .meta-row:last-child { border-bottom: none; }
  .meta-cell { padding: 6px 9px; font-size: 11px; border-right: 1px solid #bbb; }
  .meta-cell:last-child { border-right: none; }
  .meta-label { font-weight: bold; color: #555; font-size: 9.5px; display: block; text-transform: uppercase; }
  .meta-value { font-size: 11.5px; font-weight: 600; }
  .buyer-terms-grid { display: grid; grid-template-columns: 55% 45%; border-bottom: 1px solid #777; }
  .buyer-block { padding: 10px 14px; border-right: 1px solid #777; }
  .buyer-block .label { font-size: 9.5px; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 5px; }
  .buyer-block p { line-height: 1.6; font-size: 11.5px; }
  .terms-block { padding: 10px 14px; }
  .terms-label { font-size: 9.5px; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 5px; }
  .terms-block p { font-size: 11px; margin-bottom: 4px; }
  .section-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #777; }
  .section-table th { background: #d1fae5; color: #14532d; padding: 8px 6px; border: 1px solid #999; font-size: 11px; text-align: center; }
  .section-table td { padding: 8px; border: 1px solid #999; vertical-align: top; font-size: 11px; }
  .total-row td { font-weight: bold; background: #f0fdf4; }
  .words-row { padding: 8px 14px; border-bottom: 1px solid #777; font-size: 11px; }
  .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; min-height: 120px; border-bottom: 1px solid #777; }
  .declaration-block { padding: 10px 14px; border-right: 1px solid #777; font-size: 10.5px; line-height: 1.6; }
  .declaration-block .dec-title { font-weight: bold; margin-bottom: 4px; font-size: 11px; }
  .bank-block { padding: 10px 14px; font-size: 10.5px; line-height: 1.8; }
  .bank-block .bank-title { font-weight: bold; margin-bottom: 4px; font-size: 11px; text-decoration: underline; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr; }
  .sig-cell { padding: 12px 14px; font-size: 11px; border-right: 1px solid #777; min-height: 80px; display: flex; align-items: flex-end; }
  .sig-cell:last-child { border-right: none; flex-direction: column; align-items: flex-end; justify-content: flex-end; }
</style>
</head>
<body>
<div class="outer-border">
  <div class="title-bar">QUOTATION</div>
  <div class="top-grid">
    <div class="company-block">
      ${logoSrc ? `
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <img src="${logoSrc}" style="width:70px;height:auto;object-fit:contain;">
        <div style="line-height:1.5;">
          <div class="name">KVB Green Energies</div>
          <p>R16, KSSIDC, 3rd Cross, Belur Industrial Estate,<br>Dharwad – 580011, Karnataka, India</p>
          <p>Phone: +91 95455 29950, +91 74118 93555</p>
          <p style="font-weight:bold;">GSTIN: 29AAXFK4926A1Z0</p>
        </div>
      </div>` : `
      <div class="name">KVB Green Energies</div>
      <p>R16, KSSIDC, 3rd Cross, Belur Industrial Estate,<br>Dharwad – 580011, Karnataka, India</p>
      <p>Phone: +91 95455 29950, +91 74118 93555</p>
      <p style="font-weight:bold;">GSTIN: 29AAXFK4926A1Z0</p>`}
    </div>
    <div class="meta-block">
      <div class="meta-row">
        <div class="meta-cell"><span class="meta-label">Quotation No.</span><span class="meta-value">${quotation.quotationNumber}</span></div>
        <div class="meta-cell"><span class="meta-label">Dated</span><span class="meta-value">${new Date(quotation.quotationDate).toLocaleDateString('en-IN')}</span></div>
      </div>
      <div class="meta-row">
        <div class="meta-cell"><span class="meta-label">Valid Until</span><span class="meta-value">${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-IN') : '—'}</span></div>
        <div class="meta-cell"><span class="meta-label">Lead Reference</span><span class="meta-value">${quotation.lead?.leadNumber || ''}</span></div>
      </div>
    </div>
  </div>
  <div class="buyer-terms-grid">
    <div class="buyer-block">
      <div class="label">Customer (Bill to)</div>
      <p><strong>${quotation.customer?.contactName || ''}</strong></p>
      ${quotation.customer?.companyName ? `<p>${quotation.customer.companyName}</p>` : ''}
      ${quotation.customer?.address ? `<p>${quotation.customer.address}</p>` : ''}
      <p>Ph: ${quotation.customer?.phone || ''}</p>
      ${quotation.customer?.email ? `<p>Email: ${quotation.customer.email}</p>` : ''}
    </div>
    <div class="terms-block">
      <div class="terms-label">Payment &amp; Delivery Terms</div>
      ${quotation.paymentTerms ? `<p><strong>Payment:</strong> ${quotation.paymentTerms}</p>` : ''}
      ${quotation.deliveryTerms ? `<p><strong>Delivery:</strong> ${quotation.deliveryTerms}</p>` : ''}
    </div>
  </div>
  <table class="section-table">
    <thead>
      <tr>
        <th style="width:5%">Sl No.</th>
        <th style="width:33%">Description of Goods</th>
        <th style="width:10%">HSN/SAC</th>
        <th style="width:10%">Quantity</th>
        <th style="width:15%">Rate</th>
        <th style="width:10%">Per</th>
        <th style="width:17%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
      <tr class="total-row">
        <td></td><td><strong>Total</strong></td><td></td><td></td><td></td><td></td>
        <td style="text-align:right;"><strong>₹${Number(quotation.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    </tbody>
  </table>
  <div class="words-row">
    <strong>Total Quotation Value (in words):</strong> &nbsp;<em>Rupees ${numberToWords(quotation.totalAmount)} Only</em>
  </div>
  <div class="bottom-grid">
    <div class="declaration-block">
      <div class="dec-title">Terms &amp; Conditions</div>
      <p>${quotation.termsConditions || 'Standard terms apply.'}</p>
      <br/>
      <div class="dec-title">Declaration</div>
      <p>We declare that this quotation shows the actual price of the goods described and that all particulars are true and correct.</p>
    </div>
    <div class="bank-block">
      <div class="bank-title">Company's Bank Details</div>
      <p>A/c Holder's Name: <strong>KVB Green Energies</strong></p>
      <p>Bank Name: <strong>Bank of Baroda</strong></p>
      <p>A/c No: <strong>89330500000481</strong></p>
      <p>Branch: <strong>Ramnagar Branch, Dharwad</strong></p>
      <p>IFS Code: <strong>BARBOVJDHMA</strong></p>
    </div>
  </div>
  <div class="sig-row">
    <div class="sig-cell">Accepted By (Name &amp; Signature)</div>
    <div class="sig-cell">
      <p>for <strong>KVB Green Energies</strong></p><br/><br/><br/>
      <p><strong>${quotation.createdBy?.firstName || ''} ${quotation.createdBy?.lastName || ''}</strong></p>
      <p>Authorised Signatory</p>
    </div>
  </div>
</div>
</body></html>`;
}

function buildSolarTunnelDryerHTML(quotation) {
  const cf = quotation.customFields || {};

  const getDryerImg = (filename) => {
    const p = path.join(__dirname, '../assets/dryer', filename);
    if (!fs.existsSync(p)) return null;
    const data = fs.readFileSync(p);
    const ext = path.extname(filename).slice(1).replace('jpg', 'jpeg');
    return `data:image/${ext};base64,${data.toString('base64')}`;
  };
  const img1 = getDryerImg('image1.jpg');
  const img2 = getDryerImg('image2.jpeg');

  const letterheadGraphic = getDryerImg('new_img1.png');

  const toName = cf.toName || quotation.customer?.contactName || '';
  const qtnDate = cf.qtnDate || new Date(quotation.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const subjectLine = cf.subjectLine || 'Solar Tunnel Dryer for 20w x 54L = 1080 Sq ft';
  const productType = cf.productType || 'Rectangular type with top parabolic Shape';
  const dimensions = cf.dimensions || '54ft L X 20 ft W X 8.5 ft H';
  const centerHeight = cf.centerHeight || '8.5.5 feet';
  const structureDoor = cf.structureDoor || 'GP Square Pipe Frame 25x25mm';
  const purlin = cf.purlin || 'GP Square Pipe 40mm x 40mm';
  const arch = cf.arch || 'GP Square pipe 40x40mm';
  const traySize = cf.traySize || 'Tray size 2ftx3ft – Customer Scope';
  const itemDesc = cf.itemDesc || 'Supply and installation of Polycarbonate sheet covered Solar Tunnel Dryer 1080 Sq ft.';
  const qty = cf.qty || '01';
  const units = cf.units || 'Set';
  const unitPrice = Number(cf.unitPrice) || Number(quotation.totalAmount);
  const totalAmt = Number(quotation.totalAmount) || Number(cf.totalAmt) || Number(cf.unitPrice) || 0;
  const paymentTerms = cf.paymentTerms || '70% Advance along with PO 30% against Performa invoice after inspection at factory prior to despatch';
  const packingTerms = cf.packingTerms != null ? cf.packingTerms : '3% extra, (Bubble sheet / corrugated sheet)';
  const freightTerms = cf.freightTerms != null ? cf.freightTerms : 'To your account';
  const gstRate = cf.gstRate != null ? cf.gstRate : 18;

  const fmt = (v) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0 });
  const amountWords = numberToWords(totalAmt);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Quotation ${quotation.quotationNumber}</title>
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; }
  
  body { 
    font-family: "Calibri", Arial, sans-serif; 
    font-size: 11pt; 
    color: #000; 
  }

  .letterhead-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -100;
    object-fit: cover;
  }

  .layout-table { width: 100%; border-collapse: collapse; border: none; }
  .layout-table > thead > tr > td { height: 155px; border: none; padding: 0; }
  .layout-table > tfoot > tr > td { height: 90px;  border: none; padding: 0; }
  .content-cell { padding: 20px 50px 0 50px; vertical-align: top; }

  .to-date { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11pt; }
  .to-line { font-size: 11pt; }
  .date-line { font-size: 11pt; white-space: nowrap; }

  .sub-line { font-weight: bold; font-size: 11pt; margin: 8px 0 16px 0; }

  .para { font-size: 11pt; margin: 6px 0; line-height: 1.55; text-align: justify; }
  .ol-sections { margin: 6px 0 10px 40px; font-size: 11pt; line-height: 1.6; }
  .ol-sections li { font-style: italic; font-weight: bold; }
  .sign-off { margin-top: 15px; font-size: 11pt; line-height: 1.6; }

  .sec-head { font-weight: bold; font-size: 11pt; margin: 14px 0 6px 0; }

  .spec-wrap { margin-bottom: 15px; margin-top: 15px; }
  .spec-title { font-weight: bold; font-size: 11pt; text-align: center; border: 1px solid #000; border-bottom: none; padding: 5px; background: transparent; }
  .spec-table { width: 100%; border-collapse: collapse; }
  .spec-table td { border: 1px solid #000; padding: 4px 8px; font-size: 10.5pt; vertical-align: top; }
  .spec-table td:first-child { width: 35%; font-weight: normal; }

  .fin-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .fin-table th { border: 1px solid #000; padding: 5px 8px; font-size: 10.5pt; font-style: italic; font-weight: bold; text-align: center; background: transparent; }
  .fin-table td { border: 1px solid #000; padding: 5px 8px; font-size: 10.5pt; vertical-align: top; }
  .fin-table .center { text-align: center; }
  .fin-table .right { text-align: right; }
  .fin-table .total-row td { font-weight: bold; font-style: italic; }

  .amt-words { font-weight: bold; font-size: 11pt; margin: 6px 0 14px 0; }

  .terms-h { font-weight: bold; font-size: 12pt; color: #1F497D; margin: 16px 0 6px 0; }
  .terms-ul { margin: 0 0 6px 26px; font-size: 11pt; list-style: disc; }
  .terms-ul li { margin: 3px 0; line-height: 1.55; }

  .bank-label { font-style: italic; font-weight: bold; font-size: 12pt; color: #1F497D; margin: 12px 0 4px 0; }
  .bank-table { border-collapse: collapse; font-size: 11pt; font-style: italic; }
  .bank-table td { padding: 2px 8px 2px 0; vertical-align: top; }

  .ref-title { font-weight: bold; font-size: 12pt; margin: 14px 0 10px 0; }
  .ref-img { max-width: 480px; width: 100%; height: auto; margin: 6px auto; display: block; }
  .page-break { page-break-before: always; }
  
  .social-block { font-size: 10pt; font-weight: bold; line-height: 1.6; margin-top: 20px; }
  .social-block a { color: blue; text-decoration: none; word-break: break-all; }
</style>
</head>
<body>

  ${letterheadGraphic ? `<img src="${letterheadGraphic}" class="letterhead-bg" alt="" />` : ''}

  <table class="layout-table">
    <thead>
      <tr><td></td></tr>
    </thead>
    <tbody>
      <tr>
        <td class="content-cell">

          <div class="to-date">
            <div class="to-line">
              To,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${toName}
            </div>
            <div class="date-line">Date :${qtnDate}</div>
          </div>

          <div class="sub-line">Sub: ${subjectLine}</div>

          <p class="para">We thank you for the valuable enquiry. We have great pleasure in proposing our best &amp; most competitive offer, as enumerated below for your kind perusal.</p>
          <p class="para">For your easy evaluation we have segregated the proposal as below:</p>
          <div style="margin: 6px 0 12px 20px;">
            <div style="font-weight:bold; font-style:italic; margin-bottom:2px;">1. Proposal Technical specifications</div>
            <div style="font-weight:bold; font-style:italic; margin-bottom:2px;">2. Financial Offer</div>
            <div style="font-weight:bold; font-style:italic; margin-bottom:2px;">3. Term &amp; conditions</div>
          </div>
          <p class="para">In case of any clarifications, please feel free to get in touch with us.</p>
          <p class="para">We trust our offer is in line with your requirement and look forward for your valued order. Thanking and assuring you of our best attention and service at all times.</p>
          <div class="sign-off">
            Yours Faithfully,<br/>
            <br/><br/>
            KVB Green Energies &ndash; Dharwad Karnataka. 9545529950.
          </div>

          <div class="page-break"></div>

          <div style="font-weight:bold; font-size:11pt; margin-bottom: 20px;">1. Technical Specifications</div>
          
          <div class="spec-wrap">
            <div class="spec-title">TECHNICAL SPECIFICATION OF SOLAR TUNNEL DRYER</div>
            <table class="spec-table">
              <tr><td>Absorber</td><td>Poly Carbonate 6 mm thickness</td></tr>
              <tr><td>Absorber</td><td>BIS Approved</td></tr>
              <tr><td>Absorber Sheets</td><td>Top and Bottom Ultra Violet stabilized with 60 Microns</td></tr>
              <tr><td>Shape</td><td>${productType}</td></tr>
              <tr><td>Area</td><td>${dimensions}</td></tr>
              <tr><td>Center height</td><td>${centerHeight}</td></tr>
              <tr><td>Temperature</td><td>55 - 65&deg;C ( based on the climatic condition on a full sunny day )</td></tr>
              <tr><td>Structure &amp; Door</td><td>${structureDoor}</td></tr>
              <tr><td>Structure Purlin</td><td>${purlin}</td></tr>
              <tr><td>Arch</td><td>${arch}</td></tr>
              <tr><td>Sealing</td><td>Silicon sealant with EPDM</td></tr>
              <tr><td>Exhaust</td><td>AC Fan Provided</td></tr>
              <tr><td>Automatic Control Panel</td><td>Temp / Moisture</td></tr>
              <tr><td>Base Pipes</td><td>GP Square Pipe 40mm x 40mm base plate 6 mm thickness</td></tr>
              <tr><td>Automatic Control Panel</td><td>Temperature sensor and Humidity sensor with IOT integration</td></tr>
              <tr><td>Tray and trolley</td><td>${traySize}</td></tr>
            </table>
          </div>

          <div style="font-weight:bold; font-size:11pt; margin: 20px 0 10px 20px;">2. Financial Offer:</div>

          <table class="fin-table">
            <thead>
              <tr>
                <th style="width:50%;text-align:center;"><em>Capacity Of system</em></th>
                <th colspan="3" style="text-align:center;"><em>Solar Power Generation</em></th>
              </tr>
              <tr>
                <th style="text-align:center;"><em>DESCRIPTION</em></th>
                <th style="width:10%;"><em>Qty</em></th>
                <th style="width:12%;"><em>Units</em></th>
                <th style="width:14%;"><em>Rate</em></th>
                <th style="width:14%;"><em>Amount</em></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><em><strong>${itemDesc}</strong></em></td>
                <td class="center"><em>${qty}</em></td>
                <td class="center"><em>${units}</em></td>
                <td class="center"><em>${fmt(unitPrice)}/-</em></td>
                <td class="center"><em>${fmt(totalAmt)}/-</em></td>
              </tr>
              <tr class="total-row">
                <td colspan="4" style="text-align:right;"><em>Grand Total</em></td>
                <td class="center"><em>${fmt(totalAmt)}/-</em></td>
              </tr>
            </tbody>
          </table>

          <div style="font-weight:bold; font-size:11pt; text-align:center; margin: 20px 0 10px 0;">${amountWords}</div>

          <div class="page-break"></div>

          <div style="font-weight:bold; font-size:11pt; margin-bottom:15px; margin-left:20px;">
            3. Term &amp; condition:
          </div>

          <div class="terms-h">Payment terms:</div>
          <ul class="terms-ul">
            <li><strong>Price</strong> &ndash; Ex works</li>
            <li><strong>Payment Terms</strong> &ndash; ${paymentTerms}</li>
            <li><strong>Packing</strong> &ndash; ${packingTerms}</li>
            <li><strong>Fright and insurance</strong> &ndash; ${freightTerms}</li>
            <li><strong>Taxes and duties</strong>- As applicable at time of despatch, presently ${gstRate}%</li>
          </ul>

          <div class="terms-h">Delivery Time:</div>
          <ul class="terms-ul">
            <li><strong>30 days</strong> from the date of <strong>Purchase Order (PO), advance payment, and drawing approval</strong></li>
          </ul>

          <div class="terms-h">Warranty:</div>
          <ul class="terms-ul">
            <li><strong>Structure (GI Square Tube): 5 years</strong></li>
            <li><strong>Electrical Components &amp; Control Panel: 12 months</strong></li>
          </ul>

          <div class="terms-h">Other Conditions:</div>
          <ul class="terms-ul">
            <li><strong>Accommodation and food for installation team will be in your scope</strong></li>
            <li><strong>Power connection till control panel will be in scope.</strong></li>
            <li><strong>Tray and trolley in your scope</strong></li>
            <li><strong>Solar panel and its controls will be at extra cost</strong></li>
            <li><strong>Civil works in your scope</strong></li>
          </ul>

          <div class="terms-h" style="margin-bottom:4px;">GST Details:</div>
          <div style="font-size:11.5pt; font-weight:bold; font-style:italic; color:#1F497D; margin-bottom:20px;">29AAXFK4926A1Z0 (KVB GREEN ENERGIES)</div>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 30%; vertical-align: top;">
                <div class="bank-label" style="margin: 0;">Bank Details:</div>
              </td>
              <td>
                <table class="bank-table" style="margin-left: 20px;">
                  <tr><td style="width:100px;">Bank Name</td><td style="width:15px;">:</td><td>Bank of Baroda</td></tr>
                  <tr><td>Account No</td><td>:</td><td>89330500000481</td></tr>
                  <tr><td>A/c Name</td><td>:</td><td>KVB Green Energies</td></tr>
                  <tr><td>A/c Type</td><td>:</td><td>Cash Credit Account</td></tr>
                  <tr><td>Branch</td><td>:</td><td>Ramnagar Branch, Dharwad</td></tr>
                  <tr><td>IFSC Code</td><td>:</td><td>BARB0VJDHMA</td></tr>
                </table>
              </td>
            </tr>
          </table>

          <div class="page-break"></div>

          <div class="ref-title">Reference Photos</div>
          
          <div style="margin-bottom:5px;">
            <span style="font-weight:bold; font-size:12pt;">For Moringa Leaf drying</span>
          </div>
          ${img1 ? `<img src="${img1}" class="ref-img" alt="Moringa Leaf Drying"/>` : ''}
          
          <div style="margin-top:25px; margin-bottom:5px;">
            <span style="font-weight:bold; font-size:12pt;">For Coffee Beans Drying</span>
          </div>
          ${img2 ? `<img src="${img2}" class="ref-img" alt="Coffee Beans Drying"/>` : ''}

          <div class="social-block">
            <div style="margin-bottom:4px;">For More details - Follow us on social media</div>
            <div style="margin-bottom:4px;">Instagram - <a href="https://www.instagram.com/kvb.digital/?igsh=MTRseDExdnN0MGUycQ%3D%3D#">https://www.instagram.com/kvb.digital/?igsh=MTRseDExdnN0MGUycQ%3D%3D#</a></div>
            <div style="margin-bottom:4px;">YouTube - <a href="https://youtube.com/@kvbgreenenergies?si=VWJSfUEpeOeqk8R1">https://youtube.com/@kvbgreenenergies?si=VWJSfUEpeOeqk8R1</a></div>
            <div>Website &ndash; <a href="http://www.kvbgreenenergies.com">www.kvbgreenenergies.com</a></div>
          </div>

        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr><td></td></tr>
    </tfoot>
  </table>

</body>
</html>`;
}

// Generate PDF
exports.generatePDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch quotation details
    const quotationsList = await db.select({
      id: schema.quotations.id,
      quotationNumber: schema.quotations.quotationNumber,
      templateType: schema.quotations.templateType,
      quotationDate: schema.quotations.quotationDate,
      validUntil: schema.quotations.validUntil,
      paymentTerms: schema.quotations.paymentTerms,
      deliveryTerms: schema.quotations.deliveryTerms,
      totalAmount: schema.quotations.totalAmount,
      termsConditions: schema.quotations.termsConditions,
      customFields: schema.quotations.customFields,
      customerContactName: schema.customers.contactName,
      customerCompanyName: schema.customers.companyName,
      customerAddress: schema.customers.address,
      customerPhone: schema.customers.phone,
      customerEmail: schema.customers.email,
      leadLeadNumber: schema.leads.leadNumber,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.quotations)
    .leftJoin(schema.customers, eq(schema.quotations.customerId, schema.customers.id))
    .leftJoin(schema.leads, eq(schema.quotations.leadId, schema.leads.id))
    .leftJoin(schema.users, eq(schema.quotations.createdById, schema.users.id))
    .where(eq(schema.quotations.id, id))
    .limit(1);

    if (quotationsList.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    const rawPdf = quotationsList[0];
    const quotation = {
      id: rawPdf.id, quotationNumber: rawPdf.quotationNumber, templateType: rawPdf.templateType,
      quotationDate: rawPdf.quotationDate, validUntil: rawPdf.validUntil, paymentTerms: rawPdf.paymentTerms,
      deliveryTerms: rawPdf.deliveryTerms, totalAmount: rawPdf.totalAmount, termsConditions: rawPdf.termsConditions,
      customFields: rawPdf.customFields,
      customer: rawPdf.customerContactName ? { contactName: rawPdf.customerContactName, companyName: rawPdf.customerCompanyName, address: rawPdf.customerAddress, phone: rawPdf.customerPhone, email: rawPdf.customerEmail } : null,
      lead: rawPdf.leadLeadNumber ? { leadNumber: rawPdf.leadLeadNumber } : null,
      createdBy: rawPdf.createdByFirstName ? { firstName: rawPdf.createdByFirstName, lastName: rawPdf.createdByLastName } : null
    };

    // Fetch items
    const itemsRaw2 = await db.select({
      id: schema.quotationItems.id,
      quotationId: schema.quotationItems.quotationId,
      productId: schema.quotationItems.productId,
      description: schema.quotationItems.description,
      quantity: schema.quotationItems.quantity,
      unitPrice: schema.quotationItems.unitPrice,
      discount: schema.quotationItems.discount,
      taxRate: schema.quotationItems.taxRate,
      totalPrice: schema.quotationItems.totalPrice,
      productName: schema.products.name,
      productHsnCode: schema.products.hsnCode,
      productUnitOfMeasure: schema.products.unitOfMeasure,
      productDescription: schema.products.description
    })
    .from(schema.quotationItems)
    .leftJoin(schema.products, eq(schema.quotationItems.productId, schema.products.id))
    .where(eq(schema.quotationItems.quotationId, id));

    quotation.items = itemsRaw2.map(i => ({
      id: i.id, quotationId: i.quotationId, productId: i.productId, description: i.description,
      quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate, totalPrice: i.totalPrice,
      product: i.productName ? { name: i.productName, hsnCode: i.productHsnCode, unitOfMeasure: i.productUnitOfMeasure, description: i.productDescription } : null
    }));

    let html;
    switch (quotation.templateType) {
      case 'SOLAR_TUNNEL_DRYER':
        html = buildSolarTunnelDryerHTML(quotation);
        break;
      case 'STANDARD':
      default:
        html = buildStandardHTML(quotation);
        break;
    }

    const ts = Date.now();
    const pdfPath = path.join(__dirname, '../../uploads/quotations', `${quotation.quotationNumber}-${ts}.pdf`);
    if (!fs.existsSync(path.dirname(pdfPath))) {
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    }

    let quotBrowser;
    try {
      quotBrowser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox', '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
          '--no-first-run', '--disable-gpu'
        ]
      });
      const quotPage = await quotBrowser.newPage();
      await quotPage.setContent(html, { waitUntil: 'networkidle0' });
      await quotPage.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
      });
    } finally {
      if (quotBrowser) await quotBrowser.close();
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.download(pdfPath, `Quotation-${quotation.quotationNumber}.pdf`, () => {
      fs.unlink(pdfPath, () => { });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Convert quotation to sale
exports.convertToSale = async (req, res) => {
  try {
    const { id } = req.params;

    const quotationsList = await db.select({
      id: schema.quotations.id,
      quotationNumber: schema.quotations.quotationNumber,
      customerId: schema.quotations.customerId,
      leadId: schema.quotations.leadId,
      subTotal: schema.quotations.subTotal,
      discountAmount: schema.quotations.discountAmount,
      taxAmount: schema.quotations.taxAmount,
      totalAmount: schema.quotations.totalAmount,
      notes: schema.quotations.notes,
      status: schema.quotations.status,
      saleId: schema.quotations.saleId
    })
    .from(schema.quotations)
    .where(eq(schema.quotations.id, id))
    .limit(1);

    const quotation = quotationsList[0];
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    if (quotation.status === 'CONVERTED_TO_SALE') {
      return res.status(400).json({
        success: false,
        message: 'Already converted to sale',
        saleId: quotation.saleId
      });
    }

    // Fetch items
    const items = await db.select().from(schema.quotationItems).where(eq(schema.quotationItems.quotationId, id));

    const finalSale = await db.transaction(async (tx) => {
      const saleCountRes = await tx.select({ count: sql`count(*)` }).from(schema.sales);
      const saleCount = Number(saleCountRes[0]?.count || 0);
      const saleNumber = `INV-${String(saleCount + 1).padStart(5, '0')}`;
      const saleId = randomUUID();

      await tx.insert(schema.sales).values({
        id: saleId,
        saleNumber,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        createdById: req.user.id,
        subTotal: String(quotation.subTotal),
        discountAmount: String(quotation.discountAmount),
        taxAmount: String(quotation.taxAmount),
        totalAmount: String(quotation.totalAmount),
        balanceAmount: String(quotation.totalAmount),
        notes: quotation.notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const saleItemsToInsert = items.map(item => ({
        id: randomUUID(),
        saleId,
        productId: item.productId,
        description: item.description || null,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        discount: String(item.discount || 0),
        taxRate: String(item.taxRate || 18),
        totalPrice: String(item.totalPrice)
      }));

      await tx.insert(schema.saleItems).values(saleItemsToInsert);

      await tx.update(schema.quotations)
        .set({
          status: 'CONVERTED_TO_SALE',
          saleId: saleId,
          updatedAt: new Date()
        })
        .where(eq(schema.quotations.id, id));

      await tx.update(schema.leads)
        .set({ status: 'ORDER_CONFIRMED', updatedAt: new Date() })
        .where(eq(schema.leads.id, quotation.leadId));

      await tx.insert(schema.leadTimeline).values({
        id: randomUUID(),
        leadId: quotation.leadId,
        action: 'Quotation Converted to Sale',
        description: `Quotation ${quotation.quotationNumber} converted → Sale ${saleNumber}`,
        performedBy: req.user.id,
        createdAt: new Date()
      });

      return { id: saleId, saleNumber };
    });

    res.json({ success: true, data: finalSale, saleId: finalSale.id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate DOCX
exports.generateDOCX = async (req, res) => {
  try {
    const { id } = req.params;

    const quotationsRawList = await db.select({
      id: schema.quotations.id,
      quotationNumber: schema.quotations.quotationNumber,
      templateType: schema.quotations.templateType,
      quotationDate: schema.quotations.quotationDate,
      validUntil: schema.quotations.validUntil,
      paymentTerms: schema.quotations.paymentTerms,
      deliveryTerms: schema.quotations.deliveryTerms,
      totalAmount: schema.quotations.totalAmount,
      notes: schema.quotations.notes,
      termsConditions: schema.quotations.termsConditions,
      customFields: schema.quotations.customFields,
      customerId: schema.quotations.customerId,
      leadId: schema.quotations.leadId,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName,
      customerContactName: schema.customers.contactName,
      customerCompanyName: schema.customers.companyName,
      customerCity: schema.customers.city,
      customerAddress: schema.customers.address,
      customerPhone: schema.customers.phone,
      customerEmail: schema.customers.email
    })
    .from(schema.quotations)
    .leftJoin(schema.customers, eq(schema.quotations.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.quotations.createdById, schema.users.id))
    .where(eq(schema.quotations.id, id))
    .limit(1);

    if (quotationsRawList.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const rawQuot = quotationsRawList[0];
    const quotation = {
      id: rawQuot.id,
      quotationNumber: rawQuot.quotationNumber,
      templateType: rawQuot.templateType,
      quotationDate: rawQuot.quotationDate,
      validUntil: rawQuot.validUntil,
      paymentTerms: rawQuot.paymentTerms,
      deliveryTerms: rawQuot.deliveryTerms,
      totalAmount: rawQuot.totalAmount,
      notes: rawQuot.notes,
      termsConditions: rawQuot.termsConditions,
      customFields: rawQuot.customFields,
      customerId: rawQuot.customerId,
      leadId: rawQuot.leadId,
      createdBy: rawQuot.createdByFirstName ? {
        firstName: rawQuot.createdByFirstName,
        lastName: rawQuot.createdByLastName
      } : null,
      customer: rawQuot.customerContactName ? {
        contactName: rawQuot.customerContactName,
        companyName: rawQuot.customerCompanyName,
        city: rawQuot.customerCity,
        address: rawQuot.customerAddress,
        phone: rawQuot.customerPhone,
        email: rawQuot.customerEmail
      } : null
    };

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
      productName: schema.products.name,
      productHsnCode: schema.products.hsnCode,
      productUnitOfMeasure: schema.products.unitOfMeasure,
      productDescription: schema.products.description
    })
    .from(schema.quotationItems)
    .leftJoin(schema.products, eq(schema.quotationItems.productId, schema.products.id))
    .where(eq(schema.quotationItems.quotationId, id));

    quotation.items = itemsRaw.map(i => ({
      id: i.id,
      quotationId: i.quotationId,
      productId: i.productId,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRate: i.taxRate,
      totalPrice: i.totalPrice,
      product: i.productName ? {
        name: i.productName,
        hsnCode: i.productHsnCode,
        unitOfMeasure: i.productUnitOfMeasure,
        description: i.productDescription
      } : null
    }));

    // Solar Tunnel Dryer
    if (quotation.templateType === 'SOLAR_TUNNEL_DRYER') {
      const PizZip = require('pizzip');
      const Docxtemplater = require('docxtemplater');
      const templatePath = path.join(__dirname, '../assets/dryer_template.docx');
      const content = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      const cf = quotation.customFields || {};
      const rawTotal = Number(quotation.totalAmount) || Number(cf.totalAmt) || Number(cf.unitPrice) || 0;
      const totalAmt = rawTotal.toLocaleString('en-IN');
      const totalAmtWords = numberToWords(Number(cf.totalAmt || quotation.totalAmount || 0));
      const rawUnitPrice = Number(cf.unitPrice) || Number(quotation.totalAmount) || 0;
      
      doc.render({
        quotationNumber: quotation.quotationNumber,
        quotRef: quotation.quotationNumber,
        refer: quotation.quotationNumber,
        qutoref: quotation.quotationNumber,
        toName: cf.toName || quotation.customer?.contactName || '',
        qtnDate: cf.qtnDate || new Date(quotation.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        subjectLine: cf.subjectLine || '',
        productType: cf.productType || '',
        dimensions: cf.dimensions || '',
        centerHeight: cf.centerHeight || '',
        structureDoor: cf.structureDoor || '',
        purlin: cf.purlin || '',
        arch: cf.arch || '',
        traySize: cf.traySize || '',
        itemDesc: cf.itemDesc || '',
        qty: String(cf.qty || 1),
        units: cf.units || 'Set',
        unitPrice: rawUnitPrice.toLocaleString('en-IN'),
        totalAmt: totalAmt,
        paymentTerms: cf.paymentTerms || '',
        deliveryTerms: cf.deliveryTerms || '',
        packingTerms: cf.packingTerms || '',
        freightTerms: cf.freightTerms || '',
        gstRate: `presently ${cf.gstRate || 18}%`,
        amountWords: totalAmtWords,
      });

      const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=Quotation-${quotation.quotationNumber}.docx`);
      return res.send(buf);
    }

    // Solar Parabolic Cooker
    if (quotation.templateType === 'SOLAR_PARABOLIC_COOKER') {
      const PizZip = require('pizzip');
      const Docxtemplater = require('docxtemplater');
      const templatePath = path.join(__dirname, '../assets/cooker_template.docx');
      let rawContent;
      try {
        rawContent = fs.readFileSync(templatePath, 'binary');
      } catch (err) {
        return res.status(500).json({ success: false, message: 'cooker_template.docx not found in assets.' });
      }

      const cf = quotation.customFields || {};
      const pricePerCylinder = parseFloat(cf.pricePerCylinder) || 180;
      const kgPerCylinder = parseFloat(cf.kgPerCylinder) || 19.2;
      const monthsPerYear = parseInt(cf.monthsPerYear) || 10;

      const feasibilityRows = (cf.feasibilityRows || []).map(row => {
        const lpg = parseFloat(row.lpgPerMonth) || 0;
        const kgOfLpg = (lpg * kgPerCylinder).toFixed(1);
        const amount = Math.round(lpg * pricePerCylinder);
        const totalAmt = Math.round(amount * monthsPerYear);
        return {
          noOfMonth: String(row.noOfMonth || ''),
          lpgPerMonth: String(lpg),
          kgOfLpg: String(kgOfLpg),
          amount: amount.toLocaleString('en-IN'),
          totalAmount: totalAmt.toLocaleString('en-IN'),
        };
      });

      const zip = new PizZip(rawContent);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      doc.render({
        quotationNumber: quotation.quotationNumber,
        quotRef: quotation.quotationNumber,
        refer: quotation.quotationNumber,
        paybackPeriod: cf.paybackPeriod || '1 year (10 Months).',
        item_desc: cf.item_desc || 'Supply of 4 Sq mtr Solar Parabolic cooker',
        item_qty: cf.item_qty || '1',
        item_price: cf.item_price || '1,25,000/-',
        gstRate: cf.gstRate || '18',
        gstAmount: cf.gstAmount || '',
        packingRate: cf.packingRate || '3',
        packingCharge: cf.packingCharge || 'Extra',
        freightTerms: cf.freightTerms || 'To your account',
        installCharge: cf.installCharge || 'Extra',
        feasibilityRows,
      });

      const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=Quotation-${quotation.quotationNumber}.docx`);
      return res.send(buf);
    }

    // Solar Parabolic Trough
    if (quotation.templateType === 'SOLAR_PARABOLIC_TROUGH') {
      const PizZip = require('pizzip');
      const Docxtemplater = require('docxtemplater');
      const templatePath = path.join(__dirname, '../assets/parabolic_trough_template.docx');
      let rawContent;
      try {
        rawContent = fs.readFileSync(templatePath, 'binary');
      } catch (err) {
        return res.status(500).json({ success: false, message: 'parabolic_trough_template.docx not found in assets.' });
      }

      const cf = quotation.customFields || {};
      const zip = new PizZip(rawContent);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      doc.render({
        quotationNumber: quotation.quotationNumber,
        quotRef: quotation.quotationNumber,
        refer: quotation.quotationNumber,
        qtnDate: cf.qtnDate || new Date(quotation.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        toName: cf.toName || quotation.customer?.contactName || '',
        customerCompanyAndAddress: cf.customerCompanyAndAddress || quotation.customer?.companyName || '',
        customerCity: cf.customerCity || quotation.customer?.city || '',
        subjectLine: cf.subjectLine || '700 kg/hr Solar Parabolic Trough Steam Generation System',
        systemCapacity: cf.systemCapacity || '700',
        item1_desc: cf.item1_desc || '',
        item1_amt: cf.item1_amt || '0.00',
        item2_desc: cf.item2_desc || '',
        item2_amt: cf.item2_amt || '0.00',
        item3_desc: cf.item3_desc || '',
        item3_amt: cf.item3_amt || '0.00',
        item4_desc: cf.item4_desc || '',
        item4_amt: cf.item4_amt || '0.00',
        item5_desc: cf.item5_desc || '',
        item5_amt: cf.item5_amt || '0.00',
        totalAmt: cf.totalAmt || '0.00',
        amountWords: cf.amountWords || '',
        deliveryWeeks: cf.deliveryWeeks || '12–14',
        paymentTerms: cf.paymentTerms || '',
      });

      const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=Quotation-${quotation.quotationNumber}.docx`);
      return res.send(buf);
    }

    // Scheffler Dish
    if (quotation.templateType === 'SCHEFFLER_DISH') {
      const PizZip = require('pizzip');
      const Docxtemplater = require('docxtemplater');
      const templatePath = path.join(__dirname, '../assets/scheffler_template.docx');
      let rawContent;
      try {
        rawContent = fs.readFileSync(templatePath, 'binary');
      } catch (err) {
        return res.status(500).json({ success: false, message: 'scheffler_template.docx not found in assets.' });
      }

      const cf = quotation.customFields || {};
      const fuelType = cf.fuelType || 'Both';
      const showCylinder = fuelType === 'Cylinder' || fuelType === 'Both';
      const showElectricity = fuelType === 'Electricity' || fuelType === 'Both';

      const zip = new PizZip(rawContent);
      let docXml = zip.file('word/document.xml').asText();

      const cylinderTags = [
        '{cylindersPerDay}', '{costPerCylinder}', '{cylinderCostPerDay}',
        '{cylinderCostMonthly}', '{cylinderCostAnnually}',
        '{cylindersPerDayProposed}', '{costPerCylinderProposed}',
        '{cylinderCostPerDayProposed}', '{cylinderCostMonthlyProposed}',
        '{cylinderCostAnnuallyProposed}',
      ];
      const electricityTags = [
        '{electricityCostMonthly}', '{electricityCostAnnually}',
        '{electricityCostMonthlyProposed}', '{electricityCostAnnuallyProposed}',
      ];

      const removeRowsContaining = (xml, tags) => {
        let result = xml;
        for (const tag of tags) {
          let safety = 0;
          while (result.includes(tag) && safety++ < 20) {
            const tagIdx = result.indexOf(tag);
            if (tagIdx < 0) break;
            const rowStart = result.lastIndexOf('<w:tr ', tagIdx);
            const rowEnd = result.indexOf('</w:tr>', tagIdx) + '</w:tr>'.length;
            if (rowStart < 0 || rowEnd < '</w:tr>'.length) break;
            result = result.slice(0, rowStart) + result.slice(rowEnd);
          }
        }
        return result;
      };

      if (!showCylinder) docXml = removeRowsContaining(docXml, cylinderTags);
      if (!showElectricity) docXml = removeRowsContaining(docXml, electricityTags);

      zip.file('word/document.xml', docXml);

      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      const fmt = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const totalAmt = parseFloat(cf.totalAmt) || 0;

      const itemsList = (cf.items || []).map((item, idx) => ({
        sno: idx + 1,
        desc: item.desc || '',
        qty: item.qty || '',
        unit: item.unit || '',
        rate: Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        amount: Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      }));

      doc.render({
        toName: cf.toName || quotation.customer?.contactName || '',
        qtnDate: cf.qtnDate || '',
        quotationNumber: quotation.quotationNumber,
        quotRef: quotation.quotationNumber,
        refer: quotation.quotationNumber,
        dishesMealsStatement: cf.dishesMealsStatement || '',
        subjectLine: cf.subjectLine || '',
        items: itemsList,
        totalAmt: totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        amountWords: cf.amountWords || ('Rupees ' + numberToWords(totalAmt) + ' Only'),
        cylindersPerDay: fmt(cf.cylindersPerDay),
        costPerCylinder: fmt(cf.costPerCylinder),
        cylinderCostPerDay: fmt(cf.cylinderCostPerDay),
        cylinderCostMonthly: fmt(cf.cylinderCostMonthly),
        cylinderCostAnnually: fmt(cf.cylinderCostAnnually),
        electricityCostMonthly: fmt(cf.electricityCostMonthly),
        electricityCostAnnually: fmt(cf.electricityCostAnnually),
        nonSunnyDaysExpensesCurrent: cf.nonSunnyDaysExpensesCurrent || 'Consider in above calculation',
        setupCostCurrent: '0',
        totalCost1YearCurrent: fmt(cf.totalCost1YearCurrent),
        cylindersPerDayProposed: '0',
        costPerCylinderProposed: '0',
        cylinderCostPerDayProposed: '0',
        cylinderCostMonthlyProposed: '0',
        cylinderCostAnnuallyProposed: '0',
        electricityCostMonthlyProposed: '0',
        electricityCostAnnuallyProposed: '0',
        nonSunnyDaysExpensesProposed: fmt(cf.nonSunnyDaysExpensesProposed),
        setupCost: fmt(totalAmt),
        totalCost1YearProposed: fmt(cf.totalCost1YearProposed),
        roi: cf.roi || '0',
        annualMaintenanceCostCurrent: '0',
        tenYearMaintenanceCostCurrent: '0',
        totalCost10YearsCurrent: fmt(cf.totalCost10YearsCurrent),
        annualMaintenanceCost: fmt(cf.annualMaintenanceCost),
        tenYearMaintenanceCost: fmt(cf.tenYearMaintenanceCost),
        totalCost10YearsProposed: fmt(cf.totalCost10YearsProposed),
        savings: fmt(cf.savings),
        exWorksTerms: cf.exWorksTerms || 'Prices quoted are Ex works and exclusive of GST. GST will be charged at a rate of 18% on the basic price.',
        packingTerms: cf.packingTerms || 'Packing 3% Extra, Fright and insurance will be in scope.',
        paymentTerms1: cf.paymentTerms1 || '70% advance payment upon receipt of the purchase order.',
        paymentTerms2: cf.paymentTerms2 || '20%+100% taxes payment after the installation of the stand and dish',
        paymentTerms3: cf.paymentTerms3 || '10% payment after the completion of installation and commissioning.',
      });

      const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=Quotation-${quotation.quotationNumber}.docx`);
      return res.send(buf);
    }

    // Standard fallback
    const html = buildStandardHTML(quotation);
    const htmlToDocx = require('html-to-docx');
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let cleanHtml = bodyMatch ? bodyMatch[1] : html;
    cleanHtml = cleanHtml.replace(/<img[^>]+class="letterhead-bg"[^>]*>/i, '');

    const docxBuffer = await htmlToDocx(cleanHtml, null, {
      margins: { top: 720, bottom: 720, left: 720, right: 720 }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Quotation-${quotation.quotationNumber}.docx`);
    res.send(docxBuffer);
  } catch (error) {
    console.error('generateDOCX error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/quotations/product-summary
exports.getQuotationsByProduct = async (req, res) => {
  try {
    const conditions = [];
    if (req.user.role === 'EMPLOYEE') {
      conditions.push(eq(schema.quotations.createdById, req.user.id));
    }

    const itemsRaw = await db.select({
      id: schema.quotationItems.id,
      productId: schema.quotationItems.productId,
      quantity: schema.quotationItems.quantity,
      totalPrice: schema.quotationItems.totalPrice,
      productId_: schema.products.id,
      productName: schema.products.name,
      productHsnCode: schema.products.hsnCode,
      quotationId_: schema.quotations.id,
      quotationNumber: schema.quotations.quotationNumber,
      quotationCreatedAt: schema.quotations.createdAt,
      quotationTotalAmount: schema.quotations.totalAmount,
      quotationStatus: schema.quotations.status,
      customerContactName: schema.customers.contactName
    })
    .from(schema.quotationItems)
    .leftJoin(schema.products, eq(schema.quotationItems.productId, schema.products.id))
    .leftJoin(schema.quotations, eq(schema.quotationItems.quotationId, schema.quotations.id))
    .leftJoin(schema.customers, eq(schema.quotations.customerId, schema.customers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

    const items = itemsRaw.map(i => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      totalPrice: i.totalPrice,
      product: i.productId_ ? {
        id: i.productId_,
        name: i.productName,
        hsnCode: i.productHsnCode
      } : null,
      quotation: i.quotationId_ ? {
        id: i.quotationId_,
        quotationNumber: i.quotationNumber,
        createdAt: i.quotationCreatedAt,
        totalAmount: i.quotationTotalAmount,
        status: i.quotationStatus,
        customer: i.customerContactName ? {
          contactName: i.customerContactName
        } : null
      } : null
    }));

    // Group by product
    const map = new Map();
    for (const item of items) {
      const key = item.productId;
      const productName = item.product?.name || 'Unknown';
      const hsnCode = item.product?.hsnCode || '';
      if (!map.has(key)) {
        map.set(key, {
          productId: key,
          productName,
          hsnCode,
          totalQuotations: 0,
          totalQty: 0,
          totalValue: 0,
          documents: []
        });
      }
      const entry = map.get(key);
      entry.totalQuotations += 1;
      entry.totalQty += Number(item.quantity);
      entry.totalValue += Number(item.totalPrice);

      if (item.quotation) {
        entry.documents.push({
          id: item.quotation.id,
          number: item.quotation.quotationNumber,
          date: item.quotation.createdAt,
          customer: item.quotation.customer?.contactName || 'Unknown',
          qty: Number(item.quantity),
          value: Number(item.totalPrice)
        });
      }
    }

    const result = Array.from(map.values())
      .sort((a, b) => b.totalValue - a.totalValue);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
