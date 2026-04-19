const prisma = require('../utils/db');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { numberToWords } = require('../utils/numberToWords');

// Generate quotation number
const generateQuotationNumber = async () => {
  const count = await prisma.quotation.count();
  return `Q-${String(count + 1).padStart(5, '0')}`;
};

// ─── Load company logo as Base64 (embedded in PDF — Puppeteer can't fetch URLs) ─
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
    const { leadId, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (leadId) where.leadId = leadId;
    if (status) where.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          lead: { select: { leadNumber: true, title: true } },
          customer: { select: { contactName: true, companyName: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          _count: { select: { items: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.quotation.count({ where })
    ]);
    res.json({
      success: true,
      data: quotations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
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
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        lead: true,
        customer: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        items: { include: { product: true } }
      }
    });
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    res.json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create quotation — accepts templateType + customFields for product-specific formats
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
      // Template system
      templateType = 'STANDARD',
      customFields = null,
    } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { customer: true }
    });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Calculate totals from line items
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

    // For Solar Tunnel Dryer, the price is entered directly in customFields.
    // Override the DB totals so quotation.totalAmount is always the real value.
    if (templateType === 'SOLAR_TUNNEL_DRYER' && customFields) {
      // Force mathematical correctness on the backend
      const cfQty   = parseFloat(customFields.qty) || 1;
      const cfPrice = parseFloat(customFields.unitPrice) || parseFloat(customFields.totalAmt) || 0;
      const cfTotal = cfQty * cfPrice;

      // Update the customFields object so the DB saves the correct total
      customFields.totalAmt = cfTotal;
      customFields.unitPrice = cfPrice;

      if (cfTotal > 0) {
        totalAmount = cfTotal;
        taxAmount   = 0;      // GST shown as "included" in the dryer format
        subTotal    = cfTotal;
      }
    }

    const quotationNumber = await generateQuotationNumber();

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        leadId,
        customerId: lead.customerId,
        createdById: req.user.id,
        subTotal,
        discountAmount: discountAmt,
        discountPercent: discountPercent || 0,
        taxAmount,
        totalAmount,
        validUntil: validUntil ? new Date(validUntil) : null,
        paymentTerms,
        deliveryTerms,
        notes,
        termsConditions,
        templateType,
        customFields: customFields ? JSON.parse(JSON.stringify(customFields)) : null,
        items: { create: quotationItems }
      },
      include: {
        items: { include: { product: true } },
        customer: true,
        lead: true
      }
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'QUOTATION_SENT' }
    });

    await prisma.leadTimeline.create({
      data: {
        leadId,
        action: 'Quotation Created',
        description: `Quotation ${quotationNumber} [${templateType}] created — ₹${totalAmount.toLocaleString()}`,
        performedBy: req.user.id
      }
    });

    res.status(201).json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE FACTORY FUNCTIONS
// To add a new product format: add a new function below and
// add a new case to the switch in generatePDF().
// ─────────────────────────────────────────────────────────────

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
          <strong>${item.product.name}</strong>
          ${(item.description || item.product.description) ? `<br/><small style="color:#555">${item.description || item.product.description}</small>` : ''}
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
        <div class="meta-cell"><span class="meta-label">Lead Reference</span><span class="meta-value">${quotation.lead.leadNumber}</span></div>
      </div>
    </div>
  </div>
  <div class="buyer-terms-grid">
    <div class="buyer-block">
      <div class="label">Customer (Bill to)</div>
      <p><strong>${quotation.customer.contactName}</strong></p>
      ${quotation.customer.companyName ? `<p>${quotation.customer.companyName}</p>` : ''}
      ${quotation.customer.address ? `<p>${quotation.customer.address}</p>` : ''}
      <p>Ph: ${quotation.customer.phone}</p>
      ${quotation.customer.email ? `<p>Email: ${quotation.customer.email}</p>` : ''}
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
      <p><strong>${quotation.createdBy.firstName} ${quotation.createdBy.lastName}</strong></p>
      <p>Authorised Signatory</p>
    </div>
  </div>
</div>
</body></html>`;
}

/**
 * Solar Tunnel Dryer quotation PDF.
 * Exactly matches "Dryer format for CRM.docx" — same approach as buildInvoiceHTML.
 * Images extracted from the docx are embedded as base64.
 * Editable (yellow-highlighted) fields come from quotation.customFields.
 */
function buildSolarTunnelDryerHTML(quotation) {
  const cf = quotation.customFields || {};

  // ── Load reference images from docx as base64 (Puppeteer can't fetch file:// paths) ──
  const getDryerImg = (filename) => {
    const p = path.join(__dirname, '../assets/dryer', filename);
    if (!fs.existsSync(p)) return null;
    const data = fs.readFileSync(p);
    const ext = path.extname(filename).slice(1).replace('jpg', 'jpeg');
    return `data:image/${ext};base64,${data.toString('base64')}`;
  };
  const img1 = getDryerImg('image1.jpg');   // Moringa leaf drying
  const img2 = getDryerImg('image2.jpeg');  // Coffee beans drying
  
  // Full Page Stationery Watermark (Header + Fade + Footer)
  const letterheadGraphic = getDryerImg('new_img1.png');

  // ── Editable fields (yellow-highlighted in docx) ──
  const toName        = cf.toName        || quotation.customer.contactName;
  const qtnDate       = cf.qtnDate       || new Date(quotation.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const subjectLine   = cf.subjectLine   || 'QTN.KVB.STD.005. A.080426 Solar Tunnel Dryer for 20w x 54L = 1080 Sq ft';
  const productType   = cf.productType   || 'Rectangular type with top parabolic Shape';
  const dimensions    = cf.dimensions    || '54ft L X 20 ft W X 8.5 ft H';
  const centerHeight  = cf.centerHeight  || '8.5.5 feet';
  const structureDoor = cf.structureDoor || 'GP Square Pipe Frame 25x25mm';
  const purlin        = cf.purlin        || 'GP Square Pipe 40mm x 40mm';
  const arch          = cf.arch          || 'GP Square pipe 40x40mm';
  const traySize      = cf.traySize      || 'Tray size 2ftx3ft \u2013 Customer Scope';
  const itemDesc      = cf.itemDesc      || 'Supply and installation of Polycarbonate sheet covered Solar Tunnel Dryer 1080 Sq ft.';
  const qty           = cf.qty           || '01';
  const units         = cf.units         || 'Set';
  // totalAmt for the table — always use quotation.totalAmount (guaranteed correct by createQuotation)
  const unitPrice = Number(cf.unitPrice) || Number(quotation.totalAmount);
  const totalAmt  = Number(quotation.totalAmount) || Number(cf.totalAmt) || Number(cf.unitPrice) || 0;
  const paymentTerms  = cf.paymentTerms  || '70% Advance along with PO 30% against Performa invoice after inspection at factory prior to despatch';
  const packingTerms  = cf.packingTerms  != null ? cf.packingTerms : '3% extra, (Bubble sheet / corrugated sheet)';
  const freightTerms  = cf.freightTerms  != null ? cf.freightTerms : 'To your account';
  const gstRate       = cf.gstRate       != null ? cf.gstRate : 18;
  const quotRef       = cf.quotRef       || quotation.quotationNumber;

  const fmt = (v) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0 });

  // Amount in words — derives from totalAmt (same variable as Grand Total cell — always in sync)
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

  /* ── FULL PAGE STATIONERY BACKGROUND ── */
  .letterhead-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -100;
    object-fit: cover;
  }

  /* ── Page Layout ── */
  .layout-table { width: 100%; border-collapse: collapse; border: none; }
  .layout-table > thead > tr > td { height: 155px; border: none; padding: 0; }
  .layout-table > tfoot > tr > td { height: 90px;  border: none; padding: 0; }
  .content-cell { padding: 20px 50px 0 50px; vertical-align: top; }

  /* ── To/Date line ── */
  .to-date { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11pt; }
  .to-line { font-size: 11pt; }
  .date-line { font-size: 11pt; white-space: nowrap; }

  /* ── Subject ── */
  .sub-line { font-weight: bold; font-size: 11pt; margin: 8px 0 16px 0; }

  /* ── Body paragraphs ── */
  .para { font-size: 11pt; margin: 6px 0; line-height: 1.55; text-align: justify; }
  .ol-sections { margin: 6px 0 10px 40px; font-size: 11pt; line-height: 1.6; }
  .ol-sections li { font-style: italic; font-weight: bold; }
  .sign-off { margin-top: 15px; font-size: 11pt; line-height: 1.6; }

  /* ── Section headings (numbered) ── */
  .sec-head { font-weight: bold; font-size: 11pt; margin: 14px 0 6px 0; }

  /* ── Technical spec table ── */
  .spec-wrap { margin-bottom: 15px; margin-top: 15px; }
  .spec-title { font-weight: bold; font-size: 11pt; text-align: center; border: 1px solid #000; border-bottom: none; padding: 5px; background: transparent; }
  .spec-table { width: 100%; border-collapse: collapse; }
  .spec-table td { border: 1px solid #000; padding: 4px 8px; font-size: 10.5pt; vertical-align: top; }
  .spec-table td:first-child { width: 35%; font-weight: normal; }

  /* ── Financial offer table ── */
  .fin-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .fin-table th { border: 1px solid #000; padding: 5px 8px; font-size: 10.5pt; font-style: italic; font-weight: bold; text-align: center; background: transparent; }
  .fin-table td { border: 1px solid #000; padding: 5px 8px; font-size: 10.5pt; vertical-align: top; }
  .fin-table .center { text-align: center; }
  .fin-table .right { text-align: right; }
  .fin-table .total-row td { font-weight: bold; font-style: italic; }

  /* ── Amount in words ── */
  .amt-words { font-weight: bold; font-size: 11pt; margin: 6px 0 14px 0; }

  /* ── Terms sub-headings ── */
  .terms-h { font-weight: bold; font-size: 12pt; color: #1F497D; margin: 16px 0 6px 0; }
  .terms-ul { margin: 0 0 6px 26px; font-size: 11pt; list-style: disc; }
  .terms-ul li { margin: 3px 0; line-height: 1.55; }

  /* ── Bank details ── */
  .bank-label { font-style: italic; font-weight: bold; font-size: 12pt; color: #1F497D; margin: 12px 0 4px 0; }
  .bank-table { border-collapse: collapse; font-size: 11pt; font-style: italic; }
  .bank-table td { padding: 2px 8px 2px 0; vertical-align: top; }

  /* ── Reference photos ── */
  .ref-title { font-weight: bold; font-size: 12pt; margin: 14px 0 10px 0; }
  .ref-img { max-width: 480px; width: 100%; height: auto; margin: 6px auto; display: block; }
  .page-break { page-break-before: always; }
  
  /* ── Social Media ── */
  .social-block { font-size: 10pt; font-weight: bold; line-height: 1.6; margin-top: 20px; }
  .social-block a { color: blue; text-decoration: none; word-break: break-all; }
</style>
</head>
<body>

  <!-- ══ STATIONERY BACKGROUND (REPEATS EVERY PAGE) ══ -->
  ${letterheadGraphic ? `<img src="${letterheadGraphic}" class="letterhead-bg" alt="" />` : ''}

  <table class="layout-table">
    <thead>
      <tr><td></td></tr> <!-- Pushes content down on every page -->
    </thead>
    <tbody>
      <tr>
        <td class="content-cell">

          <!-- ══ TO / DATE ══ -->
          <div class="to-date">
            <div class="to-line">
              To,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${toName}
            </div>
            <div class="date-line">Date :${qtnDate}</div>
          </div>

          <!-- ══ SUBJECT ══ -->
          <div class="sub-line">Sub: ${subjectLine}</div>

          <!-- ══ INTRO LETTER ══ -->
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

          <!-- End of Page 1 Document Flow -->
          <div class="page-break"></div>

          <!-- ══ PAGE 2: TECH SPECS TABLE & FINANCIAL OFFER ══ -->
          <!-- ══ SECTION 1: TECHNICAL SPECIFICATIONS (Heading on Page 2) ══ -->
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

          <!-- ══ PAGE 3: TERMS & CONDITIONS ══ -->
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

          <!-- ══ BANK DETAILS ══ -->
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

          <!-- ══ PAGE 4: REFERENCE PHOTOS ══ -->
          <div class="ref-title">Reference Photos</div>
          
          <div style="margin-bottom:5px;">
            <span style="font-weight:bold; font-size:12pt;">For Moringa Leaf drying</span>
          </div>
          ${img1 ? `<img src="${img1}" class="ref-img" alt="Moringa Leaf Drying"/>` : ''}
          
          <div style="margin-top:25px; margin-bottom:5px;">
            <span style="font-weight:bold; font-size:12pt;">For Coffee Beans Drying</span>
          </div>
          ${img2 ? `<img src="${img2}" class="ref-img" alt="Coffee Beans Drying"/>` : ''}

          <!-- ══ SOCIAL MEDIA ══ -->
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



// ─────────────────────────────────────────────────────────────

// Generate PDF — Template Factory dispatch
// Add new product formats here by adding a new case + function.
// ─────────────────────────────────────────────────────────────
exports.generatePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        lead: true,
        createdBy: { select: { firstName: true, lastName: true } }
      }
    });
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    let html;
    switch (quotation.templateType) {
      case 'SOLAR_TUNNEL_DRYER':
        html = buildSolarTunnelDryerHTML(quotation);
        break;
      // ── Future templates go here ──
      // case 'SOLAR_WATER_HEATER':
      //   html = buildSolarWaterHeaterHTML(quotation);
      //   break;
      case 'STANDARD':
      default:
        html = buildStandardHTML(quotation);
        break;
    }

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const ts      = Date.now();
    const pdfPath = path.join(__dirname, '../../uploads/quotations', `${quotation.quotationNumber}-${ts}.pdf`);
    if (!fs.existsSync(path.dirname(pdfPath))) {
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    }

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
    });
    await browser.close();

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.download(pdfPath, `Quotation-${quotation.quotationNumber}.pdf`, () => {
      fs.unlink(pdfPath, () => {}); // clean up after download
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Convert quotation to sale — UNCHANGED
// ─────────────────────────────────────────────────────────────
exports.convertToSale = async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        lead: true,
        customer: true,
      }
    });

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    if (quotation.status === 'CONVERTED_TO_SALE') {
      const existing = await prisma.quotation.findUnique({
        where: { id },
        select: { saleId: true }
      });
      return res.status(400).json({
        success: false,
        message: 'Already converted to sale',
        saleId: existing?.saleId
      });
    }

    let sale = await prisma.sale.findUnique({
      where: { quotationId: quotation.id }
    });

    if (!sale) {
      const saleCount = await prisma.sale.count();
      const saleNumber = `INV-${String(saleCount + 1).padStart(5, '0')}`;

      const saleItems = quotation.items.map(item => ({
        productId: item.productId,
        description: item.description || null,
        quantity:   Number(item.quantity),
        unitPrice:  Number(item.unitPrice),
        discount:   Number(item.discount)   || 0,
        taxRate:    Number(item.taxRate)    || 18,
        totalPrice: Number(item.totalPrice),
      }));

      sale = await prisma.sale.create({
        data: {
          saleNumber,
          customerId:    quotation.customerId,
          quotationId:   quotation.id,
          createdById:   req.user.id,
          subTotal:      Number(quotation.subTotal),
          discountAmount: Number(quotation.discountAmount),
          taxAmount:     Number(quotation.taxAmount),
          totalAmount:   Number(quotation.totalAmount),
          balanceAmount: Number(quotation.totalAmount),
          notes: quotation.notes || null,
          items: { create: saleItems },
        },
        include: {
          customer: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          items:     { include: { product: true } },
          payments:  true,
        }
      });
    }

    await prisma.quotation.update({
      where: { id },
      data: {
        status: 'CONVERTED_TO_SALE',
        sale: { connect: { id: sale.id } }
      }
    });

    await prisma.lead.update({
      where: { id: quotation.leadId },
      data: { status: 'ORDER_CONFIRMED' }
    });

    await prisma.leadTimeline.create({
      data: {
        leadId:      quotation.leadId,
        action:      'Quotation Converted to Sale',
        description: `Quotation ${quotation.quotationNumber} converted → Sale ${sale.saleNumber}`,
        performedBy: req.user.id,
      }
    });

    res.json({ success: true, data: sale, saleId: sale.id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Generate DOCX
// ─────────────────────────────────────────────────────────────
exports.generateDOCX = async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        lead: true,
        createdBy: { select: { firstName: true, lastName: true } }
      }
    });
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // ── Solar Tunnel Dryer: use native Word template for 100% layout replica ──
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
        toName:        cf.toName || quotation.customer?.contactName || '',
        qtnDate:       cf.qtnDate || new Date(quotation.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        subjectLine:   cf.subjectLine || '',
        productType:   cf.productType || '',
        dimensions:    cf.dimensions || '',
        centerHeight:  cf.centerHeight || '',
        structureDoor: cf.structureDoor || '',
        purlin:        cf.purlin || '',
        arch:          cf.arch || '',
        traySize:      cf.traySize || '',
        itemDesc:      cf.itemDesc || '',
        qty:           String(cf.qty || 1),
        units:         cf.units || 'Set',
        unitPrice:     rawUnitPrice.toLocaleString('en-IN'),
        totalAmt:      totalAmt,
        paymentTerms:  cf.paymentTerms || '',
        deliveryTerms: cf.deliveryTerms || '',
        packingTerms:  cf.packingTerms || '',
        freightTerms:  cf.freightTerms || '',
        gstRate:       `presently ${cf.gstRate || 18}%`,
        amountWords:   totalAmtWords,
      });

      const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=Quotation-${quotation.quotationNumber}.docx`);
      return res.send(buf);
    }

    // ── Standard quotation: fall back to html-to-docx ─────────────────────────
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
