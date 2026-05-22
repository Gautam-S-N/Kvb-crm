const { eq, and, inArray, sql, desc, asc, like, lt, gte, or } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { triggerRefreshForEmployee } = require('../services/achievement.service');
const { randomUUID } = require('crypto');

// ─── Load company logo as Base64 (embedded in PDF) ───────────────────────────
const getLogoBase64 = () => {
  const exts = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
  const assetsDir = path.join(__dirname, '../assets');
  for (const ext of exts) {
    const logoPath = path.join(assetsDir, `logo.${ext}`);
    if (fs.existsSync(logoPath)) {
      const data = fs.readFileSync(logoPath);
      const mimeMap = { png: 'image/png', gjpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' };
      return `data:${mimeMap[ext] || 'image/jpeg'};base64,${data.toString('base64')}`;
    }
  }
  return null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateSaleNumber = async () => {
  const settingsList = await db.select()
    .from(schema.settings)
    .where(inArray(schema.settings.key, ['INV_PREFIX', 'INV_DATE_FORMAT', 'INV_CUSTOM_YEAR']));
  const getSetting = (k, def) => settingsList.find(s => s.key === k)?.value || def;

  const prefix = getSetting('INV_PREFIX', 'INV');
  const format = getSetting('INV_DATE_FORMAT', 'FY_YY_YY');
  const customYearStr = getSetting('INV_CUSTOM_YEAR', '25-26');

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

  const countResult = await db.select({ count: sql`count(*)` })
    .from(schema.sales)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  const count = Number(countResult[0]?.count || 0);
  
  const middlePart = dateStr ? `/${dateStr}` : '';
  return `${prefix}${middlePart}/${String(count + 1).padStart(3, '0')}`;
};

const generateReceiptNumber = async () => {
  const countResult = await db.select({ count: sql`count(*)` }).from(schema.payments);
  const count = Number(countResult[0]?.count || 0);
  return `RCP-${String(count + 1).padStart(5, '0')}`;
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// ─── Number-to-words ─────────────────────────────────────────────────────────
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function inWords(num) {
  if (num === 0) return 'Zero';
  const n = Math.round(num);
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
  if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
  if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
  return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
}

// ─── Invoice HTML Template ───────────────────────────────────────────────────
const buildInvoiceHTML = (sale) => {
  const logoSrc = getLogoBase64();
  let meta = {};
  const rawNotes = sale.notes || '';
  const metaMatch = rawNotes.match(/__META__({.*})/);
  if (metaMatch) {
    try { meta = JSON.parse(metaMatch[1]); } catch {}
  }
  const taxType = meta.taxType || 'CGST_SGST';

  const taxableAmount = Number(sale.subTotal) - Number(sale.discountAmount);
  const totalTax = Number(sale.taxAmount);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;

  const itemsRows = sale.items.map((item, i) => {
    const qty = Number(item.quantity);
    const rate = Number(item.unitPrice);
    const disc = Number(item.discount) || 0;
    const amount = qty * rate * (1 - disc / 100);
    const hsn = item.hsnCode || item.product?.hsnCode || '';
    const uom = item.uom || item.product?.unitOfMeasure || 'Nos';
    return `
      <tr>
        <td style="text-align:center;border:1px solid #999;padding:6px 4px;">${i + 1}</td>
        <td style="border:1px solid #999;padding:6px 4px;">
          <strong>${item.product?.name || ''}</strong>
          ${item.description ? `<br/><small style="color:#555">${item.description}</small>` : ''}
        </td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:center;">${hsn}</td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:center;">${qty}</td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:right;">₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:center;">${uom}</td>
        <td style="border:1px solid #999;padding:6px 4px;text-align:right;">₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>`;
  }).join('');

  const gstRows = sale.items.map((item) => {
    const qty = Number(item.quantity);
    const rate = Number(item.unitPrice);
    const disc = Number(item.discount) || 0;
    const itemTaxable = qty * rate * (1 - disc / 100);
    const gstRate = Number(item.taxRate) || 18;
    const hsn = item.hsnCode || item.product?.hsnCode || '';
    const totalItemTax = itemTaxable * (gstRate / 100);

    if (taxType === 'IGST') {
      return `
        <tr>
          <td style="border:1px solid #999;padding:5px 4px;text-align:center;">${hsn}</td>
          <td style="border:1px solid #999;padding:5px 4px;text-align:right;">₹${itemTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="border:1px solid #999;padding:5px 4px;text-align:center;" colspan="4">${gstRate}% IGST = ₹${totalItemTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="border:1px solid #999;padding:5px 4px;text-align:right;">₹${totalItemTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>`;
    }
    const half = totalItemTax / 2;
    return `
      <tr>
        <td style="border:1px solid #999;padding:5px 4px;text-align:center;">${hsn}</td>
        <td style="border:1px solid #999;padding:5px 4px;text-align:right;">₹${itemTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="border:1px solid #999;padding:5px 4px;text-align:center;">${gstRate / 2}%</td>
        <td style="border:1px solid #999;padding:5px 4px;text-align:right;">₹${half.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="border:1px solid #999;padding:5px 4px;text-align:center;">${gstRate / 2}%</td>
        <td style="border:1px solid #999;padding:5px 4px;text-align:right;">₹${half.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="border:1px solid #999;padding:5px 4px;text-align:right;">₹${totalItemTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>`;
  }).join('');

  const gstTableHeader = taxType === 'IGST' ? `
    <tr>
      <th rowspan="2" style="border:1px solid #999;padding:6px;background:#d1fae5;color:#14532d;font-size:11px;">HSN/SAC</th>
      <th rowspan="2" style="border:1px solid #999;padding:6px;background:#d1fae5;color:#14532d;font-size:11px;">Taxable Value</th>
      <th colspan="4" style="border:1px solid #999;padding:6px;background:#d1fae5;color:#14532d;font-size:11px;">IGST</th>
      <th rowspan="2" style="border:1px solid #999;padding:6px;background:#d1fae5;color:#14532d;font-size:11px;">Total Tax Amount</th>
    </tr><tr><th colspan="4" style="border:1px solid #999;padding:4px;background:#d1fae5;color:#14532d;font-size:10px;">Rate & Amount</th></tr>` : `
    <tr>
      <th rowspan="2" style="border:1px solid #999;padding:6px;background:#d1fae5;color:#14532d;font-size:11px;">HSN/SAC</th>
      <th rowspan="2" style="border:1px solid #999;padding:6px;background:#d1fae5;color:#14532d;font-size:11px;">Taxable Value</th>
      <th colspan="2" style="border:1px solid #999;padding:6px;background:#d1fae5;color:#14532d;font-size:11px;">CGST</th>
      <th colspan="2" style="border:1px solid #999;padding:6px;background:#d1fae5;color:#14532d;font-size:11px;">SGST/UTGST</th>
      <th rowspan="2" style="border:1px solid #999;padding:6px;background:#d1fae5;color:#14532d;font-size:11px;">Total Tax Amount</th>
    </tr>
    <tr>
      <th style="border:1px solid #999;padding:4px;background:#d1fae5;color:#14532d;font-size:10px;">Rate</th>
      <th style="border:1px solid #999;padding:4px;background:#d1fae5;color:#14532d;font-size:10px;">Amount</th>
      <th style="border:1px solid #999;padding:4px;background:#d1fae5;color:#14532d;font-size:10px;">Rate</th>
      <th style="border:1px solid #999;padding:4px;background:#d1fae5;color:#14532d;font-size:10px;">Amount</th>
    </tr>`;

  const gstTotalRow = taxType === 'IGST' ? `
    <tr style="font-weight:bold;background:#f0fdf4;">
      <td style="border:1px solid #999;padding:5px;"></td>
      <td style="border:1px solid #999;padding:5px;text-align:right;">₹${taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td style="border:1px solid #999;padding:5px;" colspan="4"></td>
      <td style="border:1px solid #999;padding:5px;text-align:right;">₹${totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>` : `
    <tr style="font-weight:bold;background:#f0fdf4;">
      <td style="border:1px solid #999;padding:5px;"></td>
      <td style="border:1px solid #999;padding:5px;text-align:right;">₹${taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td style="border:1px solid #999;padding:5px;"></td>
      <td style="border:1px solid #999;padding:5px;text-align:right;">₹${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td style="border:1px solid #999;padding:5px;"></td>
      <td style="border:1px solid #999;padding:5px;text-align:right;">₹${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td style="border:1px solid #999;padding:5px;text-align:right;">₹${totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${sale.saleNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px 28px; }
    .outer-border { border: 2px solid #333; }
    .title-bar { text-align: center; font-size: 16px; font-weight: bold; border-bottom: 2px solid #333; padding: 7px 0; letter-spacing: 2px; }
    .top-grid { display: grid; grid-template-columns: 55% 45%; border-bottom: 1px solid #777; }
    .company-block { padding: 10px 14px; border-right: 1px solid #777; }
    .company-block .name { font-size: 16px; font-weight: bold; color: #15803d; margin-bottom: 4px; }
    .company-block p { margin-top: 2px; line-height: 1.55; font-size: 11.5px; }
    .company-block .gstin { font-weight: bold; }
    .meta-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #bbb; }
    .meta-row:last-child { border-bottom: none; }
    .meta-cell { padding: 5px 9px; font-size: 11px; border-right: 1px solid #bbb; }
    .meta-cell:last-child { border-right: none; }
    .meta-label { font-weight: bold; color: #555; font-size: 9.5px; display: block; text-transform: uppercase; }
    .meta-value { font-size: 11.5px; font-weight: 600; }
    .buyer-dispatch-grid { display: grid; grid-template-columns: 55% 45%; border-bottom: 1px solid #777; }
    .buyer-block { padding: 10px 14px; border-right: 1px solid #777; }
    .buyer-block .buyer-label { font-size: 9.5px; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 5px; }
    .buyer-block p { line-height: 1.6; font-size: 11.5px; }
    .dispatch-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #bbb; }
    .dispatch-row:last-child { border-bottom: none; }
    .dispatch-cell { padding: 5px 9px; font-size: 11px; border-right: 1px solid #bbb; }
    .dispatch-cell:last-child { border-right: none; }
    .dispatch-cell .meta-label { font-size: 9.5px; display: block; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 2px; }
    .items-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #777; }
    .items-table th { background: #d1fae5; color: #14532d; padding: 7px 5px; border: 1px solid #999; font-size: 11px; text-align: center; }
    .items-table td { padding: 6px 5px; border: 1px solid #999; font-size: 11px; vertical-align: top; }
    .items-table tr.total-row td { font-weight: bold; background: #f0fdf4; }
    .words-row { padding: 7px 12px; border-bottom: 1px solid #777; font-size: 11px; }
    .gst-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #777; }
    .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; min-height: 130px; border-bottom: 1px solid #777; }
    .declaration-block { padding: 10px 14px; border-right: 1px solid #777; font-size: 10.5px; line-height: 1.65; }
    .declaration-block .dec-title { font-weight: bold; font-size: 11px; margin-bottom: 3px; }
    .bank-block { padding: 10px 14px; font-size: 10.5px; line-height: 1.8; }
    .bank-block .bank-title { font-weight: bold; font-size: 11px; margin-bottom: 3px; text-decoration: underline; }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr; }
    .sig-cell { padding: 10px 14px; font-size: 11px; border-right: 1px solid #777; min-height: 80px; display: flex; align-items: flex-end; }
    .sig-cell:last-child { border-right: none; flex-direction: column; align-items: flex-end; gap: 4px; }
    .jurisdiction { text-align: center; font-size: 10px; padding: 5px; color: #666; border-top: 1px solid #ccc; }
  </style>
</head>
<body>
<div class="outer-border">

  <!-- Title -->
  <div class="title-bar">TAX INVOICE</div>

  <!-- Company + Invoice Meta -->
  <div class="top-grid">
    <div class="company-block">
      ${logoSrc ? `
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <img src="${logoSrc}" alt="KVB Green Energies" style="width:90px;height:auto;object-fit:contain;flex-shrink:0;">
        <div style="line-height:1.65;font-size:11.5px;">
          <div class="name" style="font-size:15px;font-weight:bold;color:#15803d;margin-bottom:2px;">KVB Green Energies</div>
          <div>R16, KSSIDC, 3rd Cross,</div>
          <div>Belur Industrial Estate,</div>
          <div>Dharwad &ndash; 580011, Karnataka, India</div>
          <div>Phone: +91 95455 29950, +91 74118 93555</div>
          <div class="gstin">GSTIN: 29AAXFK4926A1Z0</div>
          <div>State Name: Karnataka</div>
        </div>
      </div>` : `
      <div class="name">KVB Green Energies</div>
      <p>R16, KSSIDC, 3rd Cross,</p>
      <p>Belur Industrial Estate,</p>
      <p>Dharwad &ndash; 580011, Karnataka, India</p>
      <p>Phone: +91 95455 29950, +91 74118 93555</p>
      <p class="gstin">GSTIN: 29AAXFK4926A1Z0</p>
      <p>State Name: Karnataka</p>`}
    </div>
    <div class="meta-block">
      <div class="meta-row">
        <div class="meta-cell">
          <span class="meta-label">Invoice No.</span>
          <span class="meta-value">${sale.saleNumber}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">Dated</span>
          <span class="meta-value">${new Date(sale.saleDate || sale.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
      </div>
      <div class="meta-row">
        <div class="meta-cell">
          <span class="meta-label">Delivery Note</span>
          <span class="meta-value">${meta.deliveryNote || '&nbsp;'}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">Mode/Terms of Payment</span>
          <span class="meta-value">${sale.paymentTerms || '&nbsp;'}</span>
        </div>
      </div>
      <div class="meta-row">
        <div class="meta-cell">
          <span class="meta-label">Reference No. &amp; Date</span>
          <span class="meta-value">${sale.quotation?.quotationNumber || '&nbsp;'}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">Other Reference(s)</span>
          <span class="meta-value">&nbsp;</span>
        </div>
      </div>
      <div class="meta-row">
        <div class="meta-cell">
          <span class="meta-label">Buyer's Order No.</span>
          <span class="meta-value">${meta.buyersOrderNo || '&nbsp;'}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">Dated</span>
          <span class="meta-value">&nbsp;</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Buyer + Dispatch -->
  <div class="buyer-dispatch-grid">
    <div class="buyer-block">
      <div class="buyer-label">Buyer (Bill to)</div>
      <p><strong>${sale.customer.contactName}</strong></p>
      ${sale.customer.companyName ? `<p>${sale.customer.companyName}</p>` : ''}
      ${sale.customer.address ? `<p>${sale.customer.address}</p>` : ''}
      ${sale.customer.city ? `<p>${sale.customer.city}${sale.customer.state ? ', ' + sale.customer.state : ''}</p>` : ''}
      <p>Ph: ${sale.customer.phone}</p>
      ${sale.customer.email ? `<p>Email: ${sale.customer.email}</p>` : ''}
      ${sale.customer.gstNumber ? `<p><strong>GSTIN: ${sale.customer.gstNumber}</strong></p>` : ''}
    </div>
    <div class="dispatch-block">
      <div class="dispatch-row">
        <div class="dispatch-cell">
          <span class="meta-label">Dispatch Doc No.</span>
          ${meta.dispatchDocNo || '&nbsp;'}
        </div>
        <div class="dispatch-cell">
          <span class="meta-label">Delivery Note Date</span>
          &nbsp;
        </div>
      </div>
      <div class="dispatch-row">
        <div class="dispatch-cell">
          <span class="meta-label">Dispatched Through</span>
          ${meta.dispatchedThrough || '&nbsp;'}
        </div>
        <div class="dispatch-cell">
          <span class="meta-label">Destination</span>
          ${meta.destination || '&nbsp;'}
        </div>
      </div>
      <div class="dispatch-row">
        <div class="dispatch-cell" style="grid-column:span 2">
          <span class="meta-label">Terms of Delivery</span>
          ${meta.termsOfDelivery || '&nbsp;'}
        </div>
      </div>
    </div>
  </div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:5%">Sl No.</th>
        <th style="width:33%">Description of Goods</th>
        <th style="width:10%">HSN/SAC</th>
        <th style="width:10%">Quantity</th>
        <th style="width:13%">Rate</th>
        <th style="width:7%">UOM</th>
        <th style="width:12%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
      <tr class="total-row">
        <td></td>
        <td><strong>Total</strong></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align:right;"><strong>₹${Number(sale.subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- GST Breakdown Table -->
  <table class="gst-table">
    <thead>${gstTableHeader}</thead>
    <tbody>
      ${gstRows}
      ${gstTotalRow}
    </tbody>
  </table>

  <!-- Tax in Words row -->
  <div class="words-row" style="border-bottom:1px solid #777;">
    <strong>Tax Amount (in words):</strong>
    &nbsp;Rupees <em>${inWords(Math.round(Number(sale.taxAmount)))} Only</em>
  </div>

  <!-- Declaration + Bank Details -->
  <div class="bottom-grid">
    <div class="declaration-block">
      <div class="dec-title">Total Amount (in words)</div>
      <p style="margin-bottom:10px;font-weight:600;">Rupees ${inWords(Math.round(Number(sale.totalAmount)))} Only</p>
      <div class="dec-title">Declaration</div>
      <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
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

  <!-- Signatures -->
  <div class="sig-row">
    <div class="sig-cell">Customer's Seal and Signature</div>
    <div class="sig-cell">
      <p>for <strong>KVB Green Energies</strong></p>
      <br/><br/><br/>
      <p><strong>${sale.createdBy.firstName} ${sale.createdBy.lastName}</strong></p>
      <p>Authorised Signatory</p>
    </div>
  </div>

  <div class="jurisdiction">SUBJECT TO HUBLI JURISDICTION</div>
</div>
</body>
</html>`;
};

// ─── Receipt HTML Template ────────────────────────────────────────────────────
const buildReceiptHTML = (payment, sale) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${payment.receiptNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; padding: 40px; max-width: 600px; margin: auto; }
    .header { text-align: center; border-bottom: 3px solid #16a34a; padding-bottom: 20px; margin-bottom: 24px; }
    .company { font-size: 22px; font-weight: bold; color: #16a34a; }
    .receipt-title { font-size: 18px; margin-top: 8px; color: #555; }
    .receipt-no { font-size: 14px; color: #888; margin-top: 4px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .info-row span { color: #555; }
    .info-row strong { color: #222; }
    .amount-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
    .amount-box .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .amount-box .amount { font-size: 32px; font-weight: bold; color: #16a34a; margin-top: 4px; }
    .balance { text-align: center; margin-top: 16px; color: #555; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center; color: #888; font-size: 11px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">KVB Green Energies</div>
    <div class="receipt-title">Payment Receipt</div>
    <div class="receipt-no">${payment.receiptNumber}</div>
  </div>
  <div class="info-row"><span>Invoice #</span><strong>${sale.saleNumber}</strong></div>
  <div class="info-row"><span>Customer</span><strong>${sale.customer.contactName}</strong></div>
  ${sale.customer.companyName ? `<div class="info-row"><span>Company</span><strong>${sale.customer.companyName}</strong></div>` : ''}
  <div class="info-row"><span>Payment Date</span><strong>${new Date(payment.paymentDate).toLocaleDateString('en-IN')}</strong></div>
  <div class="info-row"><span>Payment Method</span><strong>${payment.paymentMethod}</strong></div>
  ${payment.referenceNumber ? `<div class="info-row"><span>Reference No.</span><strong>${payment.referenceNumber}</strong></div>` : ''}
  <div class="amount-box">
    <div class="label">Amount Received</div>
    <div class="amount">₹${Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
  </div>
  <div class="balance">
    <div>Invoice Total: <strong>₹${Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
    <div>Amount Paid: <strong>₹${Number(sale.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
    <div>Balance Due: <strong style="color:${Number(sale.balanceAmount) > 0 ? '#dc2626' : '#16a34a'}">₹${Number(sale.balanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
  </div>
  <div class="footer">
    <p>Thank you for your payment!</p>
    <p>This is a computer-generated receipt. KVB Green Energies</p>
  </div>
</body>
</html>
`;

// ─── Controllers ──────────────────────────────────────────────────────────────

// GET /api/sales
exports.getSales = async (req, res) => {
  try {
    const { status, paymentStatus, customerId, search, page = 1, limit = 100 } = req.query;

    const conditions = [];

    if (req.user.role === 'EMPLOYEE') {
      conditions.push(eq(schema.sales.createdById, req.user.id));
    }

    if (status) conditions.push(eq(schema.sales.status, status));
    if (paymentStatus) conditions.push(eq(schema.sales.paymentStatus, paymentStatus));
    if (customerId) conditions.push(eq(schema.sales.customerId, customerId));

    if (search) {
      conditions.push(
        or(
          like(schema.sales.saleNumber, `%${search}%`),
          like(schema.customers.contactName, `%${search}%`),
          like(schema.customers.companyName, `%${search}%`),
          like(schema.customers.phone, `%${search}%`)
        )
      );
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    const [salesRaw, countResult] = await Promise.all([
      db.select({
        id: schema.sales.id,
        saleNumber: schema.sales.saleNumber,
        customerId: schema.sales.customerId,
        createdById: schema.sales.createdById,
        quotationId: schema.sales.quotationId,
        status: schema.sales.status,
        paymentStatus: schema.sales.paymentStatus,
        subTotal: schema.sales.subTotal,
        discountAmount: schema.sales.discountAmount,
        taxAmount: schema.sales.taxAmount,
        totalAmount: schema.sales.totalAmount,
        paidAmount: schema.sales.paidAmount,
        balanceAmount: schema.sales.balanceAmount,
        notes: schema.sales.notes,
        invoiceUrl: schema.sales.invoiceUrl,
        saleDate: schema.sales.saleDate,
        createdAt: schema.sales.createdAt,
        updatedAt: schema.sales.updatedAt,
        customerId_: schema.customers.id,
        customerContactName: schema.customers.contactName,
        customerCompanyName: schema.customers.companyName,
        customerPhone: schema.customers.phone,
        createdById_: schema.users.id,
        createdByFirstName: schema.users.firstName,
        createdByLastName: schema.users.lastName
      })
      .from(schema.sales)
      .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
      .leftJoin(schema.users, eq(schema.sales.createdById, schema.users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.sales.createdAt))
      .limit(parsedLimit)
      .offset(skip),

      db.select({ count: sql`count(*)` })
        .from(schema.sales)
        .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);

    const total = Number(countResult[0]?.count || 0);
    const salesRows = salesRaw.map(r => ({
      id: r.id, saleNumber: r.saleNumber, customerId: r.customerId, createdById: r.createdById,
      quotationId: r.quotationId, status: r.status, paymentStatus: r.paymentStatus,
      subTotal: r.subTotal, discountAmount: r.discountAmount, taxAmount: r.taxAmount,
      totalAmount: r.totalAmount, paidAmount: r.paidAmount, balanceAmount: r.balanceAmount,
      notes: r.notes, invoiceUrl: r.invoiceUrl, saleDate: r.saleDate, createdAt: r.createdAt, updatedAt: r.updatedAt,
      customer: r.customerId_ ? { id: r.customerId_, contactName: r.customerContactName, companyName: r.customerCompanyName, phone: r.customerPhone } : null,
      createdBy: r.createdById_ ? { id: r.createdById_, firstName: r.createdByFirstName, lastName: r.createdByLastName } : null
    }));

    let itemsCountMap = {};
    let paymentsCountMap = {};
    if (salesRows.length > 0) {
      const saleIds = salesRows.map(s => s.id);

      const itemsCountList = await db.select({
        saleId: schema.saleItems.saleId,
        count: sql`count(*)`
      })
      .from(schema.saleItems)
      .where(inArray(schema.saleItems.saleId, saleIds))
      .groupBy(schema.saleItems.saleId);

      itemsCountList.forEach(c => {
        itemsCountMap[c.saleId] = Number(c.count || 0);
      });

      const paymentsCountList = await db.select({
        saleId: schema.payments.saleId,
        count: sql`count(*)`
      })
      .from(schema.payments)
      .where(inArray(schema.payments.saleId, saleIds))
      .groupBy(schema.payments.saleId);

      paymentsCountList.forEach(c => {
        paymentsCountMap[c.saleId] = Number(c.count || 0);
      });
    }

    const sales = salesRows.map(s => ({
      ...s,
      _count: { items: itemsCountMap[s.id] || 0, payments: paymentsCountMap[s.id] || 0 }
    }));

    const healIds = sales.filter(s => s.paymentStatus === 'PAID' && s.status !== 'COMPLETED').map(s => s.id);
    if (healIds.length > 0) {
      await db.update(schema.sales)
        .set({ status: 'COMPLETED' })
        .where(inArray(schema.sales.id, healIds));
      sales.forEach(s => {
        if (healIds.includes(s.id)) s.status = 'COMPLETED';
      });
    }

    res.json({
      success: true,
      data: sales,
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

// GET /api/sales/:id
exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    const saleRows = await db.select({
      id: schema.sales.id,
      saleNumber: schema.sales.saleNumber,
      customerId: schema.sales.customerId,
      createdById: schema.sales.createdById,
      quotationId: schema.sales.quotationId,
      status: schema.sales.status,
      paymentStatus: schema.sales.paymentStatus,
      subTotal: schema.sales.subTotal,
      discountAmount: schema.sales.discountAmount,
      taxAmount: schema.sales.taxAmount,
      totalAmount: schema.sales.totalAmount,
      paidAmount: schema.sales.paidAmount,
      balanceAmount: schema.sales.balanceAmount,
      notes: schema.sales.notes,
      invoiceUrl: schema.sales.invoiceUrl,
      saleDate: schema.sales.saleDate,
      createdAt: schema.sales.createdAt,
      updatedAt: schema.sales.updatedAt,
      customerId_: schema.customers.id,
      customerContactName: schema.customers.contactName,
      customerCompanyName: schema.customers.companyName,
      customerPhone: schema.customers.phone,
      customerEmail: schema.customers.email,
      customerAddress: schema.customers.address,
      customerCity: schema.customers.city,
      customerState: schema.customers.state,
      customerPinCode: schema.customers.pincode,
      customerGstNumber: schema.customers.gstNumber,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName,
      createdByEmail: schema.users.email,
      quotationId_: schema.quotations.id,
      quotationNumber: schema.quotations.quotationNumber
    })
    .from(schema.sales)
    .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.sales.createdById, schema.users.id))
    .leftJoin(schema.quotations, eq(schema.sales.quotationId, schema.quotations.id))
    .where(eq(schema.sales.id, id))
    .limit(1);

    if (saleRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    const rawSale = saleRows[0];
    const sale = {
      id: rawSale.id, saleNumber: rawSale.saleNumber, customerId: rawSale.customerId, createdById: rawSale.createdById,
      quotationId: rawSale.quotationId, status: rawSale.status, paymentStatus: rawSale.paymentStatus,
      subTotal: rawSale.subTotal, discountAmount: rawSale.discountAmount, taxAmount: rawSale.taxAmount,
      totalAmount: rawSale.totalAmount, paidAmount: rawSale.paidAmount, balanceAmount: rawSale.balanceAmount,
      notes: rawSale.notes, invoiceUrl: rawSale.invoiceUrl, saleDate: rawSale.saleDate,
      createdAt: rawSale.createdAt, updatedAt: rawSale.updatedAt,
      customer: rawSale.customerId_ ? { id: rawSale.customerId_, contactName: rawSale.customerContactName, companyName: rawSale.customerCompanyName, phone: rawSale.customerPhone, email: rawSale.customerEmail, address: rawSale.customerAddress, city: rawSale.customerCity, state: rawSale.customerState, pinCode: rawSale.customerPinCode, gstNumber: rawSale.customerGstNumber } : null,
      createdBy: rawSale.createdById_ ? { id: rawSale.createdById_, firstName: rawSale.createdByFirstName, lastName: rawSale.createdByLastName, email: rawSale.createdByEmail } : null,
      quotation: rawSale.quotationId_ ? { id: rawSale.quotationId_, quotationNumber: rawSale.quotationNumber } : null
    };

    const items = await db.select({
      id: schema.saleItems.id,
      saleId: schema.saleItems.saleId,
      productId: schema.saleItems.productId,
      description: schema.saleItems.description,
      quantity: schema.saleItems.quantity,
      unitPrice: schema.saleItems.unitPrice,
      discount: schema.saleItems.discount,
      taxRate: schema.saleItems.taxRate,
      totalPrice: schema.saleItems.totalPrice,
      productId_: schema.products.id,
      productName: schema.products.name,
      productHsnCode: schema.products.hsnCode,
      productUnitOfMeasure: schema.products.unitOfMeasure
    })
    .from(schema.saleItems)
    .leftJoin(schema.products, eq(schema.saleItems.productId, schema.products.id))
    .where(eq(schema.saleItems.saleId, sale.id))
    .orderBy(asc(schema.saleItems.id));

    sale.items = items.map(i => ({
      id: i.id, saleId: i.saleId, productId: i.productId, description: i.description,
      quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate, totalPrice: i.totalPrice,
      product: i.productId_ ? { id: i.productId_, name: i.productName, hsnCode: i.productHsnCode, unitOfMeasure: i.productUnitOfMeasure } : null
    }));

    const payments = await db.select()
      .from(schema.payments)
      .where(eq(schema.payments.saleId, sale.id))
      .orderBy(desc(schema.payments.paymentDate));

    sale.payments = payments;

    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/sales
exports.createSale = async (req, res) => {
  try {
    const {
      customerId,
      quotationId,
      items,
      discountAmount,
      paymentTerms,
      expectedDelivery,
      notes
    } = req.body;

    const customerRows = await db.select().from(schema.customers).where(eq(schema.customers.id, customerId)).limit(1);
    if (customerRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (quotationId) {
      const existingSaleRows = await db.select({
        id: schema.sales.id,
        saleNumber: schema.sales.saleNumber,
        createdAt: schema.sales.createdAt
      })
      .from(schema.sales)
      .where(eq(schema.sales.quotationId, quotationId))
      .limit(1);

      if (existingSaleRows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `This quotation has already been converted to Sale ${existingSaleRows[0].saleNumber}. A quotation can only be converted once.`,
          existingSaleId: existingSaleRows[0].id
        });
      }
    }

    let subTotal = 0;
    const saleItems = items.map(item => {
      const lineTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      subTotal += lineTotal;
      return {
        id: randomUUID(),
        productId: item.productId,
        description: item.description || null,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        discount: String(item.discount || 0),
        taxRate: String(item.taxRate || 18),
        totalPrice: String(lineTotal)
      };
    });

    const discountAmt = discountAmount || 0;
    const taxableAmount = subTotal - discountAmt;
    const taxAmount = taxableAmount * 0.18;
    const totalAmount = taxableAmount + taxAmount;

    const saleNumber = await generateSaleNumber();

    let fullNotes = notes || '';
    if (paymentTerms) fullNotes += (fullNotes ? '\n' : '') + `Payment Terms: ${paymentTerms}`;
    if (expectedDelivery) fullNotes += (fullNotes ? '\n' : '') + `Expected Delivery: ${new Date(expectedDelivery).toLocaleDateString('en-IN')}`;

    const saleId = randomUUID();
    const now = new Date();

    const saleData = {
      id: saleId,
      saleNumber,
      customerId,
      createdById: req.user.id,
      quotationId: quotationId || null,
      subTotal: String(subTotal),
      discountAmount: String(discountAmt),
      taxAmount: String(taxAmount),
      totalAmount: String(totalAmount),
      balanceAmount: String(totalAmount),
      notes: fullNotes || null,
      createdAt: now,
      updatedAt: now
    };

    const sale = await db.transaction(async (tx) => {
      if (quotationId) {
        const quotRows = await tx.select({
          id: schema.quotations.id,
          status: schema.quotations.status
        })
        .from(schema.quotations)
        .where(eq(schema.quotations.id, quotationId))
        .limit(1);

        const quot = quotRows[0];
        if (!quot) throw new Error('Quotation not found.');
        if (quot.status === 'CONVERTED_TO_SALE') {
          throw new Error('This quotation has already been converted to a sale.');
        }
      }

      await tx.insert(schema.sales).values(saleData);

      const itemsWithSaleId = saleItems.map(i => ({
        ...i,
        saleId
      }));
      await tx.insert(schema.saleItems).values(itemsWithSaleId);

      if (quotationId) {
        await tx.update(schema.quotations)
          .set({ status: 'CONVERTED_TO_SALE' })
          .where(eq(schema.quotations.id, quotationId));
      }

      return {
        ...saleData,
        items: itemsWithSaleId
      };
    });

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'SALES' });
      ioRefresh.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    triggerRefreshForEmployee(req.user.id, ioRefresh);

    res.status(201).json({ success: true, data: sale });
  } catch (error) {
    if (
      error.message.includes('already been converted') ||
      error.message.includes('Quotation not found')
    ) {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/sales/:id
exports.updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const saleRows = await db.select().from(schema.sales).where(eq(schema.sales.id, id)).limit(1);
    if (saleRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const updateData = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    await db.update(schema.sales).set(updateData).where(eq(schema.sales.id, id));

    const updatedRaw = await db.select({
      id: schema.sales.id,
      saleNumber: schema.sales.saleNumber,
      customerId: schema.sales.customerId,
      createdById: schema.sales.createdById,
      quotationId: schema.sales.quotationId,
      status: schema.sales.status,
      paymentStatus: schema.sales.paymentStatus,
      subTotal: schema.sales.subTotal,
      discountAmount: schema.sales.discountAmount,
      taxAmount: schema.sales.taxAmount,
      totalAmount: schema.sales.totalAmount,
      paidAmount: schema.sales.paidAmount,
      balanceAmount: schema.sales.balanceAmount,
      notes: schema.sales.notes,
      invoiceUrl: schema.sales.invoiceUrl,
      saleDate: schema.sales.saleDate,
      createdAt: schema.sales.createdAt,
      updatedAt: schema.sales.updatedAt,
      customerId_: schema.customers.id,
      customerContactName: schema.customers.contactName,
      customerCompanyName: schema.customers.companyName,
      customerPhone: schema.customers.phone,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.sales)
    .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.sales.createdById, schema.users.id))
    .where(eq(schema.sales.id, id))
    .limit(1);

    if (updatedRaw.length === 0) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    const rU = updatedRaw[0];
    const completeUpdated = {
      id: rU.id, saleNumber: rU.saleNumber, customerId: rU.customerId, createdById: rU.createdById,
      quotationId: rU.quotationId, status: rU.status, paymentStatus: rU.paymentStatus,
      subTotal: rU.subTotal, discountAmount: rU.discountAmount, taxAmount: rU.taxAmount,
      totalAmount: rU.totalAmount, paidAmount: rU.paidAmount, balanceAmount: rU.balanceAmount,
      notes: rU.notes, invoiceUrl: rU.invoiceUrl, saleDate: rU.saleDate, createdAt: rU.createdAt, updatedAt: rU.updatedAt,
      customer: rU.customerId_ ? { id: rU.customerId_, contactName: rU.customerContactName, companyName: rU.customerCompanyName, phone: rU.customerPhone } : null,
      createdBy: rU.createdById_ ? { id: rU.createdById_, firstName: rU.createdByFirstName, lastName: rU.createdByLastName } : null
    };

    const itemsRaw = await db.select({
      id: schema.saleItems.id,
      saleId: schema.saleItems.saleId,
      productId: schema.saleItems.productId,
      description: schema.saleItems.description,
      quantity: schema.saleItems.quantity,
      unitPrice: schema.saleItems.unitPrice,
      discount: schema.saleItems.discount,
      taxRate: schema.saleItems.taxRate,
      totalPrice: schema.saleItems.totalPrice,
      productId_: schema.products.id,
      productName: schema.products.name,
      productHsnCode: schema.products.hsnCode
    })
    .from(schema.saleItems)
    .leftJoin(schema.products, eq(schema.saleItems.productId, schema.products.id))
    .where(eq(schema.saleItems.saleId, id))
    .orderBy(asc(schema.saleItems.id));

    completeUpdated.items = itemsRaw.map(i => ({
      id: i.id, saleId: i.saleId, productId: i.productId, description: i.description,
      quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate, totalPrice: i.totalPrice,
      product: i.productId_ ? { id: i.productId_, name: i.productName, hsnCode: i.productHsnCode } : null
    }));

    const payments = await db.select()
      .from(schema.payments)
      .where(eq(schema.payments.saleId, id))
      .orderBy(desc(schema.payments.paymentDate));

    completeUpdated.payments = payments;

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'SALES' });
      ioRefresh.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.json({ success: true, data: completeUpdated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/sales/:id/payments
exports.recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, paymentDate, referenceNumber, notes } = req.body;

    const saleRawRows = await db.select({
      id: schema.sales.id,
      saleNumber: schema.sales.saleNumber,
      customerId: schema.sales.customerId,
      createdById: schema.sales.createdById,
      quotationId: schema.sales.quotationId,
      status: schema.sales.status,
      paymentStatus: schema.sales.paymentStatus,
      subTotal: schema.sales.subTotal,
      discountAmount: schema.sales.discountAmount,
      taxAmount: schema.sales.taxAmount,
      totalAmount: schema.sales.totalAmount,
      paidAmount: schema.sales.paidAmount,
      balanceAmount: schema.sales.balanceAmount,
      notes: schema.sales.notes,
      invoiceUrl: schema.sales.invoiceUrl,
      saleDate: schema.sales.saleDate,
      createdAt: schema.sales.createdAt,
      updatedAt: schema.sales.updatedAt,
      customerId_: schema.customers.id,
      customerContactName: schema.customers.contactName,
      customerCompanyName: schema.customers.companyName,
      customerPhone: schema.customers.phone,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.sales)
    .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.sales.createdById, schema.users.id))
    .where(eq(schema.sales.id, id))
    .limit(1);

    if (saleRawRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    const rS = saleRawRows[0];
    const sale = {
      id: rS.id, saleNumber: rS.saleNumber, customerId: rS.customerId, createdById: rS.createdById,
      quotationId: rS.quotationId, status: rS.status, paymentStatus: rS.paymentStatus,
      subTotal: rS.subTotal, discountAmount: rS.discountAmount, taxAmount: rS.taxAmount,
      totalAmount: rS.totalAmount, paidAmount: rS.paidAmount, balanceAmount: rS.balanceAmount,
      notes: rS.notes, invoiceUrl: rS.invoiceUrl, saleDate: rS.saleDate, createdAt: rS.createdAt, updatedAt: rS.updatedAt,
      customer: rS.customerId_ ? { id: rS.customerId_, contactName: rS.customerContactName, companyName: rS.customerCompanyName, phone: rS.customerPhone } : null,
      createdBy: rS.createdById_ ? { id: rS.createdById_, firstName: rS.createdByFirstName, lastName: rS.createdByLastName } : null
    };

    const paymentAmount = parseFloat(amount);
    const newPaidAmount = Number(sale.paidAmount) + paymentAmount;
    const newBalance = Number(sale.totalAmount) - newPaidAmount;

    let newPaymentStatus = 'PARTIAL';
    if (newBalance <= 0) newPaymentStatus = 'PAID';
    if (newPaidAmount <= 0) newPaymentStatus = 'UNPAID';

    const receiptNumber = await generateReceiptNumber();

    const paymentId = randomUUID();
    const paymentData = {
      id: paymentId,
      saleId: id,
      amount: String(paymentAmount),
      paymentMethod,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      referenceNumber: referenceNumber || null,
      notes: notes || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(schema.payments).values(paymentData);

    const updatedSaleData = {
      paidAmount: String(newPaidAmount),
      balanceAmount: String(Math.max(0, newBalance)),
      paymentStatus: newPaymentStatus,
      updatedAt: new Date()
    };
    if (newPaymentStatus === 'PAID' && sale.status !== 'COMPLETED') {
      updatedSaleData.status = 'COMPLETED';
    }

    await db.update(schema.sales).set(updatedSaleData).where(eq(schema.sales.id, id));

    const updatedSaleRawRows = await db.select({
      id: schema.sales.id,
      saleNumber: schema.sales.saleNumber,
      customerId: schema.sales.customerId,
      createdById: schema.sales.createdById,
      quotationId: schema.sales.quotationId,
      status: schema.sales.status,
      paymentStatus: schema.sales.paymentStatus,
      subTotal: schema.sales.subTotal,
      discountAmount: schema.sales.discountAmount,
      taxAmount: schema.sales.taxAmount,
      totalAmount: schema.sales.totalAmount,
      paidAmount: schema.sales.paidAmount,
      balanceAmount: schema.sales.balanceAmount,
      notes: schema.sales.notes,
      invoiceUrl: schema.sales.invoiceUrl,
      saleDate: schema.sales.saleDate,
      createdAt: schema.sales.createdAt,
      updatedAt: schema.sales.updatedAt,
      customerId_: schema.customers.id,
      customerContactName: schema.customers.contactName,
      customerCompanyName: schema.customers.companyName,
      customerPhone: schema.customers.phone,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.sales)
    .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.sales.createdById, schema.users.id))
    .where(eq(schema.sales.id, id))
    .limit(1);

    const updatedSale = updatedSaleRawRows[0] ? {
      id: updatedSaleRawRows[0].id, saleNumber: updatedSaleRawRows[0].saleNumber, customerId: updatedSaleRawRows[0].customerId, createdById: updatedSaleRawRows[0].createdById,
      quotationId: updatedSaleRawRows[0].quotationId, status: updatedSaleRawRows[0].status, paymentStatus: updatedSaleRawRows[0].paymentStatus,
      subTotal: updatedSaleRawRows[0].subTotal, discountAmount: updatedSaleRawRows[0].discountAmount, taxAmount: updatedSaleRawRows[0].taxAmount,
      totalAmount: updatedSaleRawRows[0].totalAmount, paidAmount: updatedSaleRawRows[0].paidAmount, balanceAmount: updatedSaleRawRows[0].balanceAmount,
      notes: updatedSaleRawRows[0].notes, invoiceUrl: updatedSaleRawRows[0].invoiceUrl, saleDate: updatedSaleRawRows[0].saleDate, createdAt: updatedSaleRawRows[0].createdAt, updatedAt: updatedSaleRawRows[0].updatedAt,
      customer: updatedSaleRawRows[0].customerId_ ? { id: updatedSaleRawRows[0].customerId_, contactName: updatedSaleRawRows[0].customerContactName, companyName: updatedSaleRawRows[0].customerCompanyName, phone: updatedSaleRawRows[0].customerPhone } : null,
      createdBy: updatedSaleRawRows[0].createdById_ ? { id: updatedSaleRawRows[0].createdById_, firstName: updatedSaleRawRows[0].createdByFirstName, lastName: updatedSaleRawRows[0].createdByLastName } : null
    } : null;

    try {
      const receiptDir = path.join(__dirname, '../../uploads/receipts');
      ensureDir(receiptDir);
      const receiptPath = path.join(receiptDir, `${receiptNumber}.pdf`);

      const paymentWithNumber = { ...paymentData, receiptNumber };
      const html = buildReceiptHTML(paymentWithNumber, updatedSale);

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({ path: receiptPath, format: 'A5', printBackground: true });
      await browser.close();

      await db.update(schema.payments)
        .set({ receiptUrl: `/uploads/receipts/${receiptNumber}.pdf` })
        .where(eq(schema.payments.id, paymentId));

      paymentData.receiptUrl = `/uploads/receipts/${receiptNumber}.pdf`;
    } catch (pdfErr) {
      console.error('Receipt PDF error:', pdfErr.message);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('notification', {
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Received',
        body: `₹${paymentAmount.toLocaleString('en-IN')} received for ${sale.saleNumber}`,
        entityType: 'sale',
        entityId: id,
        targetUserId: sale.createdById
      });
    }

    await db.insert(schema.notifications).values({
      id: randomUUID(),
      userId: sale.createdById,
      type: 'PAYMENT_RECEIVED',
      title: 'Payment Received',
      body: `₹${paymentAmount.toLocaleString('en-IN')} received for ${sale.saleNumber}`,
      entityType: 'sale',
      entityId: id,
      isRead: false,
      createdAt: new Date()
    });

    if (io) {
      io.emit('REFRESH_DATA', { module: 'SALES' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.status(201).json({
      success: true,
      data: { payment: paymentData, updatedSale }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/sales/:id/invoice
exports.generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const saleRawRows = await db.select({
      id: schema.sales.id,
      saleNumber: schema.sales.saleNumber,
      customerId: schema.sales.customerId,
      createdById: schema.sales.createdById,
      quotationId: schema.sales.quotationId,
      status: schema.sales.status,
      paymentStatus: schema.sales.paymentStatus,
      subTotal: schema.sales.subTotal,
      discountAmount: schema.sales.discountAmount,
      taxAmount: schema.sales.taxAmount,
      totalAmount: schema.sales.totalAmount,
      paidAmount: schema.sales.paidAmount,
      balanceAmount: schema.sales.balanceAmount,
      notes: schema.sales.notes,
      invoiceUrl: schema.sales.invoiceUrl,
      saleDate: schema.sales.saleDate,
      createdAt: schema.sales.createdAt,
      updatedAt: schema.sales.updatedAt,
      customerId_: schema.customers.id,
      customerContactName: schema.customers.contactName,
      customerCompanyName: schema.customers.companyName,
      customerPhone: schema.customers.phone,
      customerEmail: schema.customers.email,
      customerAddress: schema.customers.address,
      customerCity: schema.customers.city,
      customerState: schema.customers.state,
      customerPinCode: schema.customers.pincode,
      customerGstNumber: schema.customers.gstNumber,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName,
      quotationId_: schema.quotations.id,
      quotationNumber: schema.quotations.quotationNumber
    })
    .from(schema.sales)
    .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.sales.createdById, schema.users.id))
    .leftJoin(schema.quotations, eq(schema.sales.quotationId, schema.quotations.id))
    .where(eq(schema.sales.id, id))
    .limit(1);

    const sale = saleRawRows[0];
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const reconstructedSale = {
      id: sale.id, saleNumber: sale.saleNumber, customerId: sale.customerId, createdById: sale.createdById,
      quotationId: sale.quotationId, status: sale.status, paymentStatus: sale.paymentStatus,
      subTotal: sale.subTotal, discountAmount: sale.discountAmount, taxAmount: sale.taxAmount,
      totalAmount: sale.totalAmount, paidAmount: sale.paidAmount, balanceAmount: sale.balanceAmount,
      notes: sale.notes, invoiceUrl: sale.invoiceUrl, saleDate: sale.saleDate, createdAt: sale.createdAt, updatedAt: sale.updatedAt,
      customer: sale.customerId_ ? {
        id: sale.customerId_, contactName: sale.customerContactName, companyName: sale.customerCompanyName,
        phone: sale.customerPhone, email: sale.customerEmail, address: sale.customerAddress,
        city: sale.customerCity, state: sale.customerState, pinCode: sale.customerPinCode, gstNumber: sale.customerGstNumber
      } : null,
      createdBy: sale.createdById_ ? { id: sale.createdById_, firstName: sale.createdByFirstName, lastName: sale.createdByLastName } : null,
      quotation: sale.quotationId_ ? { id: sale.quotationId_, quotationNumber: sale.quotationNumber } : null
    };

    const itemsRaw = await db.select({
      id: schema.saleItems.id,
      saleId: schema.saleItems.saleId,
      productId: schema.saleItems.productId,
      description: schema.saleItems.description,
      quantity: schema.saleItems.quantity,
      unitPrice: schema.saleItems.unitPrice,
      discount: schema.saleItems.discount,
      taxRate: schema.saleItems.taxRate,
      totalPrice: schema.saleItems.totalPrice,
      productId_: schema.products.id,
      productName: schema.products.name,
      productHsnCode: schema.products.hsnCode,
      productUnitOfMeasure: schema.products.unitOfMeasure
    })
    .from(schema.saleItems)
    .leftJoin(schema.products, eq(schema.saleItems.productId, schema.products.id))
    .where(eq(schema.saleItems.saleId, reconstructedSale.id))
    .orderBy(asc(schema.saleItems.id));

    reconstructedSale.items = itemsRaw.map(i => ({
      id: i.id, saleId: i.saleId, productId: i.productId, description: i.description,
      quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate, totalPrice: i.totalPrice,
      product: i.productId_ ? { id: i.productId_, name: i.productName, hsnCode: i.productHsnCode, unitOfMeasure: i.productUnitOfMeasure } : null
    }));

    const notesText = reconstructedSale.notes || '';
    const ptMatch = notesText.match(/Payment Terms:\s*(.+)/i);
    reconstructedSale.paymentTerms = ptMatch ? ptMatch[1].trim() : null;

    const html = buildInvoiceHTML(reconstructedSale);

    const invoiceDir = path.join(__dirname, '../../uploads/invoices');
    ensureDir(invoiceDir);
    const safeFilename = reconstructedSale.saleNumber.replace(/\//g, '_');
    const invoicePath = path.join(invoiceDir, `${safeFilename}.pdf`);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: invoicePath, format: 'A4', printBackground: true });
    await browser.close();

    await db.update(schema.sales)
      .set({ invoiceUrl: `/uploads/invoices/${safeFilename}.pdf` })
      .where(eq(schema.sales.id, id));

    res.download(invoicePath, `Invoice-${safeFilename}.pdf`);
  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/sales/product-summary
exports.getSalesByProduct = async (req, res) => {
  try {
    const conditions = [];
    if (req.user.role === 'EMPLOYEE') {
      conditions.push(eq(schema.sales.createdById, req.user.id));
    }

    const itemsRaw = await db.select({
      id: schema.saleItems.id,
      saleId: schema.saleItems.saleId,
      productId: schema.saleItems.productId,
      description: schema.saleItems.description,
      quantity: schema.saleItems.quantity,
      unitPrice: schema.saleItems.unitPrice,
      discount: schema.saleItems.discount,
      taxRate: schema.saleItems.taxRate,
      totalPrice: schema.saleItems.totalPrice,
      productId_: schema.products.id,
      productName: schema.products.name,
      productHsnCode: schema.products.hsnCode,
      saleId_: schema.sales.id,
      saleNumber: schema.sales.saleNumber,
      saleDate: schema.sales.saleDate,
      saleTotalAmount: schema.sales.totalAmount,
      saleStatus: schema.sales.status,
      salePaymentStatus: schema.sales.paymentStatus,
      customerContactName: schema.customers.contactName
    })
    .from(schema.saleItems)
    .leftJoin(schema.products, eq(schema.saleItems.productId, schema.products.id))
    .leftJoin(schema.sales, eq(schema.saleItems.saleId, schema.sales.id))
    .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

    const items = itemsRaw.map(i => ({
      id: i.id,
      saleId: i.saleId,
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
        hsnCode: i.productHsnCode
      } : null,
      sale: i.saleId_ ? {
        id: i.saleId_,
        saleNumber: i.saleNumber,
        saleDate: i.saleDate,
        totalAmount: i.saleTotalAmount,
        status: i.saleStatus,
        paymentStatus: i.salePaymentStatus,
        customer: i.customerContactName ? {
          contactName: i.customerContactName
        } : null
      } : null
    }));

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
          totalSales: 0,
          totalQty: 0,
          totalRevenue: 0,
          documents: []
        });
      }
      const entry = map.get(key);
      entry.totalSales += 1;
      entry.totalQty += Number(item.quantity);
      entry.totalRevenue += Number(item.totalPrice);
      
      if (item.sale) {
        entry.documents.push({
          id: item.sale.id,
          number: item.sale.saleNumber,
          date: item.sale.saleDate,
          customer: item.sale.customer?.contactName || 'Unknown',
          qty: Number(item.quantity),
          value: Number(item.totalPrice)
        });
      }
    }

    const result = Array.from(map.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
