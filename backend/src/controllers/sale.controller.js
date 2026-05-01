const prisma = require('../utils/db');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

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
  return null; // no logo file found
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateSaleNumber = async () => {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['INV_PREFIX', 'INV_DATE_FORMAT'] } }
  });
  const getSetting = (k, def) => settings.find(s => s.key === k)?.value || def;

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

  const where = format === 'FY_YY_YY' ? {
    createdAt: { gte: fyStartDate, lt: fyEndDate }
  } : format === 'YYYY' ? {
    createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
  } : format === 'YYYYMM' ? {
    createdAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) }
  } : format === 'CUSTOM' ? {
    saleNumber: { contains: `/${customYearStr}/` }
  } : {};

  const count = await prisma.sale.count({ where });
  
  const middlePart = dateStr ? `/${dateStr}` : '';
  return `${prefix}${middlePart}/${String(count + 1).padStart(3, '0')}`;
};

const generateReceiptNumber = async () => {
  const count = await prisma.payment.count();
  return `RCP-${String(count + 1).padStart(5, '0')}`;
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// ─── Number-to-words (simple INR) ────────────────────────────────────────────
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

// ─── Invoice HTML Template (KVB Invoice-final.docx format) ───────────────────
const buildInvoiceHTML = (sale) => {
  const logoSrc = getLogoBase64();
  // Parse stored metadata from notes field
  let meta = {};
  const rawNotes = sale.notes || '';
  const metaMatch = rawNotes.match(/__META__({.*})/);
  if (metaMatch) {
    try { meta = JSON.parse(metaMatch[1]); } catch {}
  }
  const cleanNotes = rawNotes.replace(/__META__.*/, '').trim();
  const taxType = meta.taxType || 'CGST_SGST';

  const taxableAmount = Number(sale.subTotal) - Number(sale.discountAmount);
  const totalTax = Number(sale.taxAmount);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;

  // ── Items rows ──────────────────────────────────────────
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

  // ── GST breakdown rows ──────────────────────────────────
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
    // CGST + SGST
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
    .meta-block { }
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
    .dispatch-block { }
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
    const { status, paymentStatus, customerId, search, page = 1, limit = 20 } = req.query;

    const where = {};

    // Role-based filtering
    if (req.user.role === 'EMPLOYEE') {
      where.createdById = req.user.id;
    }

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (customerId) where.customerId = customerId;

    if (search) {
      where.OR = [
        { saleNumber: { contains: search } },
        { customer: { contactName: { contains: search } } },
        { customer: { companyName: { contains: search } } },
        { customer: { phone: { contains: search } } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: {
            select: { id: true, contactName: true, companyName: true, phone: true }
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true }
          },
          _count: { select: { items: true, payments: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.sale.count({ where })
    ]);

    // Auto-heal mismatches (for older records where backend wasn't setting it automatically)
    const healIds = sales.filter(s => s.paymentStatus === 'PAID' && s.status !== 'COMPLETED').map(s => s.id);
    if (healIds.length > 0) {
      await prisma.sale.updateMany({
        where: { id: { in: healIds } },
        data: { status: 'COMPLETED' }
      });
      // reflect changes locally before responding
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

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: { include: { product: true } },
        payments: { orderBy: { paymentDate: 'desc' } },
        quotation: { select: { id: true, quotationNumber: true } }
      }
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

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

    // Validate customer
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // ── Guard: one sale per quotation (only if this is a quotation conversion) ──
    if (quotationId) {
      const existingSale = await prisma.sale.findFirst({
        where: { quotationId },
        select: { id: true, saleNumber: true, createdAt: true }
      });
      if (existingSale) {
        return res.status(409).json({
          success: false,
          message: `This quotation has already been converted to Sale ${existingSale.saleNumber}. A quotation can only be converted once.`,
          existingSaleId: existingSale.id
        });
      }
    }

    // Calculate totals
    let subTotal = 0;
    const saleItems = items.map(item => {
      const lineTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      subTotal += lineTotal;
      return {
        productId: item.productId,
        description: item.description || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        taxRate: item.taxRate || 18,
        totalPrice: lineTotal
      };
    });

    const discountAmt = discountAmount || 0;
    const taxableAmount = subTotal - discountAmt;
    const taxAmount = taxableAmount * 0.18;
    const totalAmount = taxableAmount + taxAmount;

    const saleNumber = await generateSaleNumber();

    // paymentTerms and expectedDelivery are not in the Sale schema;
    // store them in the notes field so the invoice builder can read them
    let fullNotes = notes || '';
    if (paymentTerms) fullNotes += (fullNotes ? '\n' : '') + `Payment Terms: ${paymentTerms}`;
    if (expectedDelivery) fullNotes += (fullNotes ? '\n' : '') + `Expected Delivery: ${new Date(expectedDelivery).toLocaleDateString('en-IN')}`;

    // ── Run everything inside a transaction so the sale is only committed
    //    when the quotation is successfully marked as CONVERTED_TO_SALE ──
    const sale = await prisma.$transaction(async (tx) => {
      // If converting a quotation, lock-check it first (re-check inside tx)
      if (quotationId) {
        const quot = await tx.quotation.findUnique({
          where: { id: quotationId },
          select: { id: true, status: true }
        });
        if (!quot) throw new Error('Quotation not found.');
        if (quot.status === 'CONVERTED_TO_SALE') {
          throw new Error('This quotation has already been converted to a sale.');
        }
      }

      const newSale = await tx.sale.create({
        data: {
          saleNumber,
          customerId,
          createdById: req.user.id,
          quotationId: quotationId || null,
          subTotal,
          discountAmount: discountAmt,
          taxAmount,
          totalAmount,
          balanceAmount: totalAmount,
          notes: fullNotes || null,
          items: { create: saleItems }
        },
        include: {
          customer: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          items: { include: { product: true } },
          payments: true
        }
      });

      // Mark the quotation as converted — uses the relation (sales[]), NOT a saleId column
      if (quotationId) {
        await tx.quotation.update({
          where: { id: quotationId },
          data: { status: 'CONVERTED_TO_SALE' }
        });
      }

      return newSale;
    });

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'SALES' });
      ioRefresh.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (error) {
    // Surface transaction-level validation errors as 409
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
    const { status, paymentTerms, expectedDelivery, notes } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const updated = await prisma.sale.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes })
      },
      include: {
        customer: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: { include: { product: true } },
        payments: true
      }
    });

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'SALES' });
      ioRefresh.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/sales/:id/payments
exports.recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, paymentDate, referenceNumber, notes } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const paymentAmount = parseFloat(amount);
    const newPaidAmount = Number(sale.paidAmount) + paymentAmount;
    const newBalance = Number(sale.totalAmount) - newPaidAmount;

    let newPaymentStatus = 'PARTIAL';
    if (newBalance <= 0) newPaymentStatus = 'PAID';
    if (newPaidAmount <= 0) newPaymentStatus = 'UNPAID';

    const receiptNumber = await generateReceiptNumber();

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        saleId: id,
        amount: paymentAmount,
        paymentMethod,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        referenceNumber,
        notes
      }
    });

    // Update sale amounts + auto-advance status when fully paid
    const updatedSale = await prisma.sale.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: Math.max(0, newBalance),
        paymentStatus: newPaymentStatus,
        // Auto-mark sale as COMPLETED when payment is full
        ...(newPaymentStatus === 'PAID' && sale.status !== 'COMPLETED' && { status: 'COMPLETED' })
      },
      include: {
        customer: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Generate Receipt PDF
    try {
      const receiptDir = path.join(__dirname, '../../uploads/receipts');
      ensureDir(receiptDir);
      const receiptPath = path.join(receiptDir, `${receiptNumber}.pdf`);

      const paymentWithNumber = { ...payment, receiptNumber };
      const html = buildReceiptHTML(paymentWithNumber, updatedSale);

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({ path: receiptPath, format: 'A5', printBackground: true });
      await browser.close();

      // Save receipt URL to payment
      await prisma.payment.update({
        where: { id: payment.id },
        data: { receiptUrl: `/uploads/receipts/${receiptNumber}.pdf` }
      });
    } catch (pdfErr) {
      console.error('Receipt PDF error:', pdfErr.message);
      // Don't fail the whole request if PDF fails
    }

    // Emit Socket.IO notification
    const io = req.app.get('io');
    io.emit('notification', {
      type: 'PAYMENT_RECEIVED',
      title: 'Payment Received',
      body: `₹${paymentAmount.toLocaleString('en-IN')} received for ${sale.saleNumber}`,
      entityType: 'sale',
      entityId: id,
      targetUserId: sale.createdById
    });

    // Persist notification
    await prisma.notification.create({
      data: {
        userId: sale.createdById,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Received',
        body: `₹${paymentAmount.toLocaleString('en-IN')} received for ${sale.saleNumber}`,
        entityType: 'sale',
        entityId: id
      }
    });

    if (io) {
      io.emit('REFRESH_DATA', { module: 'SALES' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.status(201).json({
      success: true,
      data: { payment, updatedSale }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/sales/:id/invoice  — generate + download invoice PDF
exports.generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: { include: { product: true } },
        payments: true,
        quotation: { select: { id: true, quotationNumber: true } }
      }
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    // Extract paymentTerms stored in notes (e.g. "Payment Terms: 30 days")
    const notesText = sale.notes || '';
    const ptMatch = notesText.match(/Payment Terms:\s*(.+)/i);
    sale.paymentTerms = ptMatch ? ptMatch[1].trim() : null;

    const html = buildInvoiceHTML(sale);

    const invoiceDir = path.join(__dirname, '../../uploads/invoices');
    ensureDir(invoiceDir);
    // Use a safe filename (saleNumber may contain slashes like INV/25-26/001)
    const safeFilename = sale.saleNumber.replace(/\//g, '_');
    const invoicePath = path.join(invoiceDir, `${safeFilename}.pdf`);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: invoicePath, format: 'A4', printBackground: true });
    await browser.close();

    // Save invoice URL
    await prisma.sale.update({
      where: { id },
      data: { invoiceUrl: `/uploads/invoices/${safeFilename}.pdf` }
    });

    res.download(invoicePath, `Invoice-${safeFilename}.pdf`);
  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/sales/product-summary
// Returns each product with: totalSales count, totalQty, totalRevenue
exports.getSalesByProduct = async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'EMPLOYEE') where.sale = { createdById: req.user.id };

    const items = await prisma.saleItem.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, hsnCode: true } },
        sale: { 
          select: { 
            id: true, 
            saleNumber: true, 
            saleDate: true, 
            totalAmount: true, 
            status: true, 
            paymentStatus: true,
            customer: { select: { contactName: true } }
          } 
        }
      }
    });

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
      
      // Keep track of which sales contributed to this product
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
