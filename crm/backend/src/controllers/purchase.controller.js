const { eq, and, inArray, sql, desc, asc, like } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { incrementAndGet, syncCounterToMax } = require('../services/counter.service');
const { randomUUID } = require('crypto');

// Pre-load logo as base64 once at startup
const LOGO_PATH = path.join(__dirname, '../assets/logo.jpg');
const LOGO_B64  = fs.existsSync(LOGO_PATH)
  ? `data:image/jpeg;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`
  : null;

// Generates a unique, atomic PO number.
const generatePONumber = async () => {
  const now = new Date();
  const fy = now.getMonth() >= 3
    ? `${String(now.getFullYear()).slice(2)}/${String(now.getFullYear() + 1).slice(2)}`
    : `${String(now.getFullYear() - 1).slice(2)}/${String(now.getFullYear()).slice(2)}`;

  // Sync counter to existing max on first use to avoid collisions with old data
  const [countResult] = await db.select({ count: sql`count(*)` }).from(schema.purchaseOrders);
  const existingMax = Number(countResult?.count || 0);
  await syncCounterToMax('PURCHASE_ORDER', existingMax);
  const counter = await incrementAndGet('PURCHASE_ORDER');

  return `KVB-${fy}-${String(counter).padStart(4, '0')}`;
};

const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };

// ── Parse extra PO fields stored in notes as JSON ─────────────────────────────
const parsePoMeta = (po) => {
  let meta = {};
  try { meta = JSON.parse(po.notes || '{}'); } catch { meta = {}; }
  return {
    vendorName:    meta.vendorName    || po.vendor?.companyName || '',
    vendorGstin:   meta.vendorGstin   || po.vendor?.gstNumber   || '',
    vendorAddress: meta.vendorAddress || po.vendor?.address     || '',
    vendorPinCode: meta.vendorPinCode || po.vendor?.pinCode     || '',
    vendorPhone:   meta.vendorPhone   || po.vendor?.phone       || '',
    shipAddress:   meta.shipAddress   || 'R16, KSSIDC, 3rd Cross, Belur Industrial Estate, Dharwad',
    shipPinCode:   meta.shipPinCode   || '580 031',
    shipMNo:       meta.shipMNo       || '95455 29950',
    shipGstin:     meta.shipGstin     || '29AAXFK4926A1Z0',
    shippingMethod: meta.shippingMethod || 'Door Delivery',
    gstRate:  parseFloat(meta.gstRate  ?? 18),
    roundOff: parseFloat(meta.roundOff ?? 0),
    comments: meta.comments || 'Digitally created, signature not required',
  };
};

// ── HTML that exactly matches PO Format.xlsx ──────────────────────────────────
const buildPOHTML = (po) => {
  const meta    = parsePoMeta(po);
  const date    = new Date(po.orderDate || po.createdAt)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  const delDate = po.expectedDate
    ? new Date(po.expectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
    : '—';
  const sub    = Number(po.subTotal);
  const gstAmt = parseFloat((sub * meta.gstRate / 100).toFixed(2));
  const rnd    = meta.roundOff;
  const grand  = parseFloat((sub + gstAmt + rnd).toFixed(2));
  const fmt    = (v) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const BLUE   = '#0070C0';
  const LBLUE  = '#BDD7EE';
  const YELLOW = '#FFFF00';
  const TH     = `background:${BLUE};color:#fff;font-weight:bold;text-align:center;border:1px solid #003f87;padding:3px 5px;font-size:10px;`;
  const TD     = `border:1px solid #666;padding:2px 5px;font-size:10px;`;
  const LBL    = `font-weight:bold;`;

  const MAX_ROWS  = 14;
  const itemRows  = po.items.map((item, i) => [
    `<tr>`,
    `<td style="text-align:center;${TD}">${i + 1}</td>`,
    `<td style="${TD}">${item.itemName}${item.description ? '<br><span style="font-size:9px;color:#555">' + item.description + '</span>' : ''}</td>`,
    `<td style="text-align:center;${TD}">${item.hsnCode || ''}</td>`,
    `<td style="text-align:center;${TD}">${item.quantity}</td>`,
    `<td style="text-align:right;${TD}">${fmt(item.unitPrice)}</td>`,
    `<td style="text-align:right;${TD}">${fmt(item.totalPrice)}</td>`,
    `</tr>`
  ].join('')).join('');

  const blankRows = Array(Math.max(0, MAX_ROWS - po.items.length)).fill(
    `<tr><td style="${TD}height:15px;"> </td><td style="${TD}"> </td><td style="${TD}"> </td><td style="${TD}"> </td><td style="${TD}"> </td><td style="${TD}"> </td></tr>`
  ).join('');

  const logoCell = LOGO_B64
    ? `<td style="padding:6px 12px;width:80px;"><img src="${LOGO_B64}" style="height:60px;width:auto;object-fit:contain;"></td>`
    : `<td style="padding:6px 12px;width:80px;font-size:18px;font-weight:900;color:#1a7340;">KVB</td>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>PO ${po.poNumber}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;background:#fff;padding:10px;}table{border-collapse:collapse;width:100%;}</style>
</head>
<body>
<table style="border:2px solid ${BLUE};">
  <tr>
    ${logoCell}
    <td style="padding:8px;text-align:center;font-size:22px;font-weight:900;color:#1F4E79;border-bottom:0;">KVB GREEN ENERGIES</td>
  </tr>
  <tr><td colspan="2" style="background:${BLUE};color:#fff;text-align:center;font-weight:bold;font-size:12px;letter-spacing:3px;padding:3px;">PURCHASE ORDER</td></tr>
</table>
<table style="border:2px solid ${BLUE};border-top:none;">
  <tr style="background:${YELLOW};">
    <td style="${TD}${LBL}width:8%;">PO No:</td>
    <td style="${TD}font-weight:bold;color:#1F4E79;width:38%;">${po.poNumber}</td>
    <td style="${TD}${LBL}width:16%;text-align:right;">DATE :</td>
    <td style="${TD}font-weight:bold;width:38%;text-align:right;">${date}</td>
  </tr>
</table>
<table style="border:2px solid ${BLUE};border-top:none;">
  <tr>
    <th style="${TH}width:50%;">VENDOR</th>
    <th style="${TH}width:50%;border-left:2px solid ${BLUE};">SHIP TO</th>
  </tr>
  <tr>
    <td style="${TD}background:${YELLOW};"><span style="${LBL}">Name Of Company:</span> ${meta.vendorName}</td>
    <td style="${TD}border-left:2px solid ${BLUE};"><span style="${LBL}">Name Of Company:</span> KVB GREEN ENERGIES</td>
  </tr>
  <tr>
    <td style="${TD}background:${YELLOW};"><span style="${LBL}">GSTIN:</span> ${meta.vendorGstin}</td>
    <td style="${TD}border-left:2px solid ${BLUE};"><span style="${LBL}">GSTIN:</span> 29AAXFK4926A1Z0</td>
  </tr>
  <tr>
    <td style="${TD}background:${YELLOW};"><span style="${LBL}">Address:</span> ${meta.vendorAddress}</td>
    <td style="${TD}background:${YELLOW};border-left:2px solid ${BLUE};"><span style="${LBL}">Address:</span> ${meta.shipAddress}</td>
  </tr>
  <tr>
    <td style="${TD}background:${YELLOW};"><span style="${LBL}">Pin Code:</span> ${meta.vendorPinCode}</td>
    <td style="${TD}background:${YELLOW};border-left:2px solid ${BLUE};"><span style="${LBL}">Pin Code:</span> ${meta.shipPinCode}</td>
  </tr>
  <tr>
    <td style="${TD}background:${YELLOW};"><span style="${LBL}">M No:</span> ${meta.vendorPhone}</td>
    <td style="${TD}border-left:2px solid ${BLUE};"><span style="${LBL}">M No:</span> ${meta.shipMNo}</td>
  </tr>
</table>
<table style="border:2px solid ${BLUE};border-top:none;">
  <tr>
    <th style="background:${LBLUE};color:#000;font-weight:bold;text-align:center;border:1px solid #666;padding:3px;font-size:10px;width:34%;">SHIPPING TERMS</th>
    <th style="background:${LBLUE};color:#000;font-weight:bold;text-align:center;border:1px solid #666;padding:3px;font-size:10px;width:33%;border-left:2px solid ${BLUE};">SHIPPING METHOD</th>
    <th style="background:${LBLUE};color:#000;font-weight:bold;text-align:center;border:1px solid #666;padding:3px;font-size:10px;width:33%;border-left:2px solid ${BLUE};">DELIVERY DATE</th>
  </tr>
  <tr>
    <td style="${TD}text-align:center;">Cost, Insurance &amp; Freight</td>
    <td style="${TD}text-align:center;background:${YELLOW};border-left:2px solid ${BLUE};">${meta.shippingMethod}</td>
    <td style="${TD}text-align:center;background:${YELLOW};border-left:2px solid ${BLUE};">${delDate}</td>
  </tr>
</table>
<table style="border:2px solid ${BLUE};border-top:none;">
  <thead>
    <tr>
      <th style="${TH}width:6%;">Sl.No.</th>
      <th style="${TH}width:36%;border-left:1px solid #003f87;">Item Name</th>
      <th style="${TH}width:12%;border-left:1px solid #003f87;">HSN Code</th>
      <th style="${TH}width:8%;border-left:1px solid #003f87;">QTY</th>
      <th style="${TH}width:19%;border-left:1px solid #003f87;">UNIT PRICE</th>
      <th style="${TH}width:19%;border-left:1px solid #003f87;">TOTAL</th>
    </tr>
  </thead>
  <tbody>${itemRows}${blankRows}</tbody>
</table>
<table style="border:2px solid ${BLUE};border-top:none;">
  <tr>
    <td style="${TD}width:55%;vertical-align:top;padding:6px 8px;">
      <div style="font-weight:bold;margin-bottom:3px;font-size:10px;">Comments or Special Instructions</div>
      <div style="font-size:10px;">${meta.comments}</div>
    </td>
    <td style="width:45%;padding:0;vertical-align:top;border-left:2px solid ${BLUE};">
      <table style="width:100%;border:none;">
        <tr><td style="${TD}font-weight:bold;background:#f0f0f0;">SUB-TOTAL</td><td style="${TD}text-align:right;background:#f0f0f0;">${fmt(sub)}</td></tr>
        <tr><td style="${TD}background:${YELLOW};">GST @ ${meta.gstRate} %</td><td style="${TD}text-align:right;background:${YELLOW};">${fmt(gstAmt)}</td></tr>
        <tr><td style="${TD}background:${YELLOW};">Round Off</td><td style="${TD}text-align:right;background:${YELLOW};">${rnd >= 0 ? '+' : ''}${rnd.toFixed(2)}</td></tr>
        <tr><td style="${TH}text-align:left;">GRAND TOTAL</td><td style="${TH}text-align:right;">${fmt(grand)}</td></tr>
      </table>
    </td>
  </tr>
</table>
<table style="border:2px solid ${BLUE};border-top:none;">
  <tr><td style="background:linear-gradient(to right,#1a7340,${BLUE});color:#fff;text-align:center;padding:5px;font-style:italic;font-weight:bold;font-size:11px;">Let us Help the Sun, To Help You</td></tr>
</table>
</body>
</html>`;
};

// ── XLSX using the master template ────────────────────────────────────────────
const generateXLSXBuffer = async (po) => {
  const meta    = parsePoMeta(po);
  const date    = new Date(po.orderDate || po.createdAt).toLocaleDateString('en-IN');
  const delDate = po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('en-IN') : '';
  const sub     = Number(po.subTotal);
  const gstAmt  = parseFloat((sub * meta.gstRate / 100).toFixed(2));
  const rnd     = meta.roundOff;
  const grand   = parseFloat((sub + gstAmt + rnd).toFixed(2));

  const templatePath = path.join(__dirname, '../assets/po_template.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.worksheets[0];

  ws.getCell('J6').value = po.poNumber;
  ws.getCell('M6').value = date;

  ws.getCell('I8').value  = 'Name Of Company: ' + meta.vendorName;
  ws.getCell('I9').value  = 'GSTIN: ' + meta.vendorGstin;
  ws.getCell('I10').value = 'Address: ' + meta.vendorAddress;
  ws.getCell('I11').value = 'Pin Code: ' + meta.vendorPinCode;
  ws.getCell('I12').value = 'M No: ' + meta.vendorPhone;

  ws.getCell('K8').value  = 'Name Of Company: KVB GREEN ENERGIES';
  ws.getCell('K9').value  = 'GSTIN: 29AAXFK4926A1Z0';
  ws.getCell('K10').value = 'Address: ' + meta.shipAddress;
  ws.getCell('K11').value = 'Pin Code: ' + meta.shipPinCode;
  ws.getCell('K12').value = 'M No: ' + meta.shipMNo;

  ws.getCell('K14').value = meta.shippingMethod;
  ws.getCell('M14').value = delDate;

  for (let r = 16; r <= 31; r++) {
    ['I', 'J', 'K', 'L', 'M', 'N'].forEach(c => { ws.getCell(`${c}${r}`).value = null; });
  }

  po.items.forEach((item, i) => {
    const r = 16 + i;
    ws.getCell(`I${r}`).value = i + 1;
    ws.getCell(`J${r}`).value = item.itemName + (item.description ? '\n' + item.description : '');
    ws.getCell(`K${r}`).value = item.hsnCode || '';
    ws.getCell(`L${r}`).value = Number(item.quantity);
    ws.getCell(`M${r}`).value = Number(item.unitPrice);
    ws.getCell(`N${r}`).value = Number(item.totalPrice);
  });

  ws.getCell('N32').numFmt = '#,##0.00';
  ws.getCell('N33').numFmt = '#,##0.00';
  ws.getCell('N34').numFmt = '#,##0.00';
  ws.getCell('N35').numFmt = '#,##0.00';

  ws.getCell('N32').value = sub;
  ws.getCell('M33').value = `GST @ ${meta.gstRate} %`;
  ws.getCell('N33').value = gstAmt;
  ws.getCell('N34').value = rnd;
  ws.getCell('N35').value = grand;

  ws.getColumn('I').width = 8;
  ws.getColumn('J').width = 40;
  ws.getColumn('K').width = 11;
  ws.getColumn('L').width = 7;
  ws.getColumn('M').width = 14;
  ws.getColumn('N').width = 12;

  return await wb.xlsx.writeBuffer();
};

// ── DOCX ──────────────────────────────────────────────────────────────────────
const generateDOCXBuffer = async (po) => {
  const htmlToDocx = require('html-to-docx');
  const html = buildPOHTML(po);
  const result = await htmlToDocx(html, null, {
    margins: { top: 400, bottom: 400, left: 600, right: 600 },
    orientation: 'portrait',
    fontSize: 20,
  });
  return Buffer.isBuffer(result) ? result : Buffer.from(result);
};

// GET /api/purchase
exports.getPurchaseOrders = async (req, res) => {
  try {
    const { status, vendorId, search, page = 1, limit = 100 } = req.query;
    const conditions = [];
    if (status) conditions.push(eq(schema.purchaseOrders.status, status));
    if (vendorId) conditions.push(eq(schema.purchaseOrders.vendorId, vendorId));
    if (search) {
      conditions.push(like(schema.purchaseOrders.poNumber, `%${search}%`));
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    const [ordersRaw, countResult] = await Promise.all([
      db.select({
        id: schema.purchaseOrders.id,
        poNumber: schema.purchaseOrders.poNumber,
        status: schema.purchaseOrders.status,
        subTotal: schema.purchaseOrders.subTotal,
        taxAmount: schema.purchaseOrders.taxAmount,
        totalAmount: schema.purchaseOrders.totalAmount,
        expectedDate: schema.purchaseOrders.expectedDate,
        receivedDate: schema.purchaseOrders.receivedDate,
        notes: schema.purchaseOrders.notes,
        pdfUrl: schema.purchaseOrders.pdfUrl,
        vendorId: schema.purchaseOrders.vendorId,
        createdById: schema.purchaseOrders.createdById,
        createdAt: schema.purchaseOrders.createdAt,
        updatedAt: schema.purchaseOrders.updatedAt,
        vendorId_: schema.vendors.id,
        vendorCompanyName: schema.vendors.companyName,
        vendorContactName: schema.vendors.contactName,
        createdById_: schema.users.id,
        createdByFirstName: schema.users.firstName,
        createdByLastName: schema.users.lastName
      })
      .from(schema.purchaseOrders)
      .leftJoin(schema.vendors, eq(schema.purchaseOrders.vendorId, schema.vendors.id))
      .leftJoin(schema.users, eq(schema.purchaseOrders.createdById, schema.users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.purchaseOrders.createdAt))
      .limit(parsedLimit)
      .offset(skip),

      db.select({ count: sql`count(*)` })
        .from(schema.purchaseOrders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);

    const total = Number(countResult[0]?.count || 0);
    const ordersRows = ordersRaw.map(r => ({
      id: r.id, poNumber: r.poNumber, status: r.status, subTotal: r.subTotal,
      taxAmount: r.taxAmount, totalAmount: r.totalAmount, expectedDate: r.expectedDate,
      receivedDate: r.receivedDate, notes: r.notes, pdfUrl: r.pdfUrl,
      vendorId: r.vendorId, createdById: r.createdById, createdAt: r.createdAt, updatedAt: r.updatedAt,
      vendor: r.vendorId_ ? { id: r.vendorId_, companyName: r.vendorCompanyName, contactName: r.vendorContactName } : null,
      createdBy: r.createdById_ ? { id: r.createdById_, firstName: r.createdByFirstName, lastName: r.createdByLastName } : null
    }));

    let itemsCountMap = {};
    let itemsMap = {};
    if (ordersRows.length > 0) {
      const poIds = ordersRows.map(o => o.id);
      
      const items = await db.select()
        .from(schema.purchaseOrderItems)
        .where(inArray(schema.purchaseOrderItems.purchaseOrderId, poIds))
        .orderBy(asc(schema.purchaseOrderItems.id));

      for (const item of items) {
        if (!itemsMap[item.purchaseOrderId]) itemsMap[item.purchaseOrderId] = [];
        itemsMap[item.purchaseOrderId].push(item);
        itemsCountMap[item.purchaseOrderId] = (itemsCountMap[item.purchaseOrderId] || 0) + 1;
      }
    }

    const formatted = ordersRows.map(o => ({
      ...o,
      items: itemsMap[o.id] || [],
      _count: { items: itemsCountMap[o.id] || 0 }
    }));

    res.json({
      success: true,
      data: formatted,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/purchase/:id
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const poRows = await db.select({
      id: schema.purchaseOrders.id,
      poNumber: schema.purchaseOrders.poNumber,
      status: schema.purchaseOrders.status,
      subTotal: schema.purchaseOrders.subTotal,
      taxAmount: schema.purchaseOrders.taxAmount,
      totalAmount: schema.purchaseOrders.totalAmount,
      expectedDate: schema.purchaseOrders.expectedDate,
      receivedDate: schema.purchaseOrders.receivedDate,
      notes: schema.purchaseOrders.notes,
      pdfUrl: schema.purchaseOrders.pdfUrl,
      vendorId: schema.purchaseOrders.vendorId,
      createdById: schema.purchaseOrders.createdById,
      createdAt: schema.purchaseOrders.createdAt,
      updatedAt: schema.purchaseOrders.updatedAt,
      vendorId_: schema.vendors.id,
      vendorCompanyName: schema.vendors.companyName,
      vendorContactName: schema.vendors.contactName,
      vendorPhone: schema.vendors.phone,
      vendorEmail: schema.vendors.email,
      vendorAddress: schema.vendors.address,
      vendorCity: schema.vendors.city,
      vendorState: schema.vendors.state,
      vendorPinCode: schema.vendors.pinCode,
      vendorGstNumber: schema.vendors.gstNumber,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.purchaseOrders)
    .leftJoin(schema.vendors, eq(schema.purchaseOrders.vendorId, schema.vendors.id))
    .leftJoin(schema.users, eq(schema.purchaseOrders.createdById, schema.users.id))
    .where(eq(schema.purchaseOrders.id, req.params.id))
    .limit(1);

    if (poRows.length === 0) return res.status(404).json({ success: false, message: 'Purchase order not found' });
    const rawPo = poRows[0];
    const po = {
      id: rawPo.id, poNumber: rawPo.poNumber, status: rawPo.status, subTotal: rawPo.subTotal,
      taxAmount: rawPo.taxAmount, totalAmount: rawPo.totalAmount, expectedDate: rawPo.expectedDate,
      receivedDate: rawPo.receivedDate, notes: rawPo.notes, pdfUrl: rawPo.pdfUrl,
      vendorId: rawPo.vendorId, createdById: rawPo.createdById, createdAt: rawPo.createdAt, updatedAt: rawPo.updatedAt,
      vendor: rawPo.vendorId_ ? { id: rawPo.vendorId_, companyName: rawPo.vendorCompanyName, contactName: rawPo.vendorContactName, phone: rawPo.vendorPhone, email: rawPo.vendorEmail, address: rawPo.vendorAddress, city: rawPo.vendorCity, state: rawPo.vendorState, pinCode: rawPo.vendorPinCode, gstNumber: rawPo.vendorGstNumber } : null,
      createdBy: rawPo.createdById_ ? { id: rawPo.createdById_, firstName: rawPo.createdByFirstName, lastName: rawPo.createdByLastName } : null
    };

    const items = await db.select()
      .from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.purchaseOrderId, po.id))
      .orderBy(asc(schema.purchaseOrderItems.id));

    po.items = items;

    res.json({ success: true, data: po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/purchase
exports.createPurchaseOrder = async (req, res) => {
  try {
    const {
      poNumber: customPoNumber,
      vendorName, vendorGstin, vendorAddress, vendorPinCode, vendorPhone,
      shipAddress, shipPinCode, shipMNo, shipGstin,
      shippingMethod = 'Door Delivery',
      gstRate = 18, roundOff = 0,
      comments = 'Digitally created, signature not required',
      items,
      expectedDate,
    } = req.body;

    let subTotal = 0;
    const poItems = items.map(item => {
      const total = item.quantity * item.unitPrice;
      subTotal += total;
      return {
        id: randomUUID(),
        itemName: item.itemName,
        description: item.description || null,
        hsnCode: item.hsnCode || null,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        totalPrice: String(total),
        materialId: item.materialId || null
      };
    });

    const gstAmt     = parseFloat((subTotal * gstRate / 100).toFixed(2));
    const rnd        = parseFloat(roundOff);
    const totalAmount = parseFloat((subTotal + gstAmt + rnd).toFixed(2));
    const poNumber   = (customPoNumber && customPoNumber.trim())
      ? customPoNumber.trim()
      : await generatePONumber();

    const notes = JSON.stringify({
      vendorName:    vendorName    || '',
      vendorGstin:   vendorGstin   || '',
      vendorAddress: vendorAddress || '',
      vendorPinCode: vendorPinCode || '',
      vendorPhone:   vendorPhone   || '',
      shipAddress:   shipAddress   || 'R16, KSSIDC, 3rd Cross, Belur Industrial Estate, Dharwad',
      shipPinCode:   shipPinCode   || '580 031',
      shipMNo:       shipMNo       || '95455 29950',
      shipGstin:     shipGstin     || '29AAXFK4926A1Z0',
      shippingMethod, comments,
      gstRate, roundOff: rnd,
    });

    let placeholderList = await db.select().from(schema.vendors).where(eq(schema.vendors.companyName, '__MANUAL_ENTRY__')).limit(1);
    let placeholder = placeholderList[0];
    if (!placeholder) {
      const newPlaceholderId = randomUUID();
      placeholder = {
        id: newPlaceholderId,
        companyName: '__MANUAL_ENTRY__',
        contactName: 'Manual',
        phone: '0000000000',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.insert(schema.vendors).values(placeholder);
    }

    const newPoId = randomUUID();
    const now = new Date();

    const poData = {
      id: newPoId,
      poNumber,
      createdById: req.user.id,
      vendorId: placeholder.id,
      subTotal: String(subTotal),
      taxAmount: String(gstAmt),
      totalAmount: String(totalAmount),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      notes,
      createdAt: now,
      updatedAt: now
    };

    const po = await db.transaction(async (tx) => {
      await tx.insert(schema.purchaseOrders).values(poData);

      const itemsWithPoId = poItems.map(i => ({
        ...i,
        purchaseOrderId: newPoId
      }));
      await tx.insert(schema.purchaseOrderItems).values(itemsWithPoId);

      return {
        ...poData,
        items: itemsWithPoId
      };
    });

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'PURCHASE' });
    }

    res.status(201).json({ success: true, data: po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/purchase/:id
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const {
      status, receivedDate,
      poNumber, vendorName, vendorGstin, vendorAddress, vendorPinCode, vendorPhone,
      shipAddress, shipPinCode, shipMNo, shipGstin,
      shippingMethod, gstRate, roundOff, comments,
      items, expectedDate
    } = req.body;

    const existingPOList = await db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, req.params.id)).limit(1);
    const existingPO = existingPOList[0];
    if (!existingPO) return res.status(404).json({ success: false, message: 'Purchase order not found' });

    let updateData = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (receivedDate) updateData.receivedDate = new Date(receivedDate);

    if (items && Array.isArray(items)) {
      let subTotal = 0;
      const poItems = items.map(item => {
        const total = item.quantity * item.unitPrice;
        subTotal += total;
        return {
          id: randomUUID(),
          purchaseOrderId: existingPO.id,
          itemName: item.itemName,
          description: item.description || null,
          hsnCode: item.hsnCode || null,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          totalPrice: String(total),
          materialId: item.materialId || null
        };
      });

      const parsedGstRate = gstRate !== undefined ? parseFloat(gstRate) : 18;
      const rnd = roundOff !== undefined ? parseFloat(roundOff) : 0;
      const gstAmt = parseFloat((subTotal * parsedGstRate / 100).toFixed(2));
      const totalAmount = parseFloat((subTotal + gstAmt + rnd).toFixed(2));

      const notes = JSON.stringify({
        vendorName:    vendorName    || '',
        vendorGstin:   vendorGstin   || '',
        vendorAddress: vendorAddress || '',
        vendorPinCode: vendorPinCode || '',
        vendorPhone:   vendorPhone   || '',
        shipAddress:   shipAddress   || 'R16, KSSIDC, 3rd Cross, Belur Industrial Estate, Dharwad',
        shipPinCode:   shipPinCode   || '580 031',
        shipMNo:       shipMNo       || '95455 29950',
        shipGstin:     shipGstin     || '29AAXFK4926A1Z0',
        shippingMethod: shippingMethod || 'Door Delivery',
        comments:      comments || 'Digitally created, signature not required',
        gstRate:       parsedGstRate,
        roundOff:      rnd,
      });

      updateData = {
        ...updateData,
        poNumber: poNumber || existingPO.poNumber,
        subTotal: String(subTotal),
        taxAmount: String(gstAmt),
        totalAmount: String(totalAmount),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes
      };

      await db.transaction(async (tx) => {
        await tx.update(schema.purchaseOrders).set(updateData).where(eq(schema.purchaseOrders.id, existingPO.id));
        await tx.delete(schema.purchaseOrderItems).where(eq(schema.purchaseOrderItems.purchaseOrderId, existingPO.id));
        await tx.insert(schema.purchaseOrderItems).values(poItems);
      });
    } else {
      if (req.body.notes !== undefined) {
        updateData.notes = req.body.notes;
      }
      await db.update(schema.purchaseOrders).set(updateData).where(eq(schema.purchaseOrders.id, existingPO.id));
    }

    const updatedList = await db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, existingPO.id)).limit(1);
    const updated = updatedList[0];
    const finalItems = await db.select().from(schema.purchaseOrderItems).where(eq(schema.purchaseOrderItems.purchaseOrderId, existingPO.id));
    updated.items = finalItems;

    if (status === 'RECEIVED' && existingPO.status !== 'RECEIVED') {
      for (const item of finalItems) {
        if (item.materialId) {
          await db.execute(sql`
            UPDATE materials 
            SET balance = balance + ${Number(item.quantity)}
            WHERE id = ${item.materialId}
          `);
        }
      }
    }

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'PURCHASE' });
      if (status === 'RECEIVED' && existingPO.status !== 'RECEIVED') {
        ioRefresh.emit('REFRESH_DATA', { module: 'MATERIALS' });
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper: load full PO
const loadPO = async (id) => {
  const poRows = await db.select({
    id: schema.purchaseOrders.id,
    poNumber: schema.purchaseOrders.poNumber,
    status: schema.purchaseOrders.status,
    subTotal: schema.purchaseOrders.subTotal,
    taxAmount: schema.purchaseOrders.taxAmount,
    totalAmount: schema.purchaseOrders.totalAmount,
    expectedDate: schema.purchaseOrders.expectedDate,
    receivedDate: schema.purchaseOrders.receivedDate,
    notes: schema.purchaseOrders.notes,
    pdfUrl: schema.purchaseOrders.pdfUrl,
    vendorId: schema.purchaseOrders.vendorId,
    createdById: schema.purchaseOrders.createdById,
    createdAt: schema.purchaseOrders.createdAt,
    updatedAt: schema.purchaseOrders.updatedAt,
    vendorId_: schema.vendors.id,
    vendorCompanyName: schema.vendors.companyName,
    vendorContactName: schema.vendors.contactName,
    vendorPhone: schema.vendors.phone,
    vendorEmail: schema.vendors.email,
    vendorAddress: schema.vendors.address,
    vendorCity: schema.vendors.city,
    vendorState: schema.vendors.state,
    vendorPinCode: schema.vendors.pinCode,
    vendorGstNumber: schema.vendors.gstNumber,
    createdById_: schema.users.id,
    createdByFirstName: schema.users.firstName,
    createdByLastName: schema.users.lastName
  })
  .from(schema.purchaseOrders)
  .leftJoin(schema.vendors, eq(schema.purchaseOrders.vendorId, schema.vendors.id))
  .leftJoin(schema.users, eq(schema.purchaseOrders.createdById, schema.users.id))
  .where(eq(schema.purchaseOrders.id, id))
  .limit(1);

  if (poRows.length === 0) return null;
  const rawLoadPo = poRows[0];
  const po = {
    id: rawLoadPo.id, poNumber: rawLoadPo.poNumber, status: rawLoadPo.status, subTotal: rawLoadPo.subTotal,
    taxAmount: rawLoadPo.taxAmount, totalAmount: rawLoadPo.totalAmount, expectedDate: rawLoadPo.expectedDate,
    receivedDate: rawLoadPo.receivedDate, notes: rawLoadPo.notes, pdfUrl: rawLoadPo.pdfUrl,
    vendorId: rawLoadPo.vendorId, createdById: rawLoadPo.createdById, createdAt: rawLoadPo.createdAt, updatedAt: rawLoadPo.updatedAt,
    vendor: rawLoadPo.vendorId_ ? { id: rawLoadPo.vendorId_, companyName: rawLoadPo.vendorCompanyName, contactName: rawLoadPo.vendorContactName, phone: rawLoadPo.vendorPhone, email: rawLoadPo.vendorEmail, address: rawLoadPo.vendorAddress, city: rawLoadPo.vendorCity, state: rawLoadPo.vendorState, pinCode: rawLoadPo.vendorPinCode, gstNumber: rawLoadPo.vendorGstNumber } : null,
    createdBy: rawLoadPo.createdById_ ? { id: rawLoadPo.createdById_, firstName: rawLoadPo.createdByFirstName, lastName: rawLoadPo.createdByLastName } : null
  };

  const items = await db.select()
    .from(schema.purchaseOrderItems)
    .where(eq(schema.purchaseOrderItems.purchaseOrderId, po.id))
    .orderBy(asc(schema.purchaseOrderItems.id));

  po.items = items;
  return po;
};

// GET /api/purchase/:id/pdf
exports.generatePOPDF = async (req, res) => {
  try {
    const po = await loadPO(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

    const html = buildPOHTML(po);
    const dir  = path.join(__dirname, '../../uploads/purchase-orders');
    ensureDir(dir);
    const safe     = po.poNumber.replace(/\//g, '_');
    const filePath = path.join(dir, `${safe}.pdf`);

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    } finally {
      if (browser) await browser.close();
    }

    await db.update(schema.purchaseOrders)
      .set({ pdfUrl: `/uploads/purchase-orders/${safe}.pdf` })
      .where(eq(schema.purchaseOrders.id, req.params.id));

    res.download(filePath, `PO-${safe}.pdf`);
  } catch (error) {
    console.error('PO PDF error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/purchase/:id/docx
exports.generatePODOCX = async (req, res) => {
  try {
    const po = await loadPO(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

    const buf  = await generateDOCXBuffer(po);
    const safe = po.poNumber.replace(/\//g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=PO-${safe}.docx`);
    res.send(Buffer.from(buf));
  } catch (error) {
    console.error('PO DOCX error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/purchase/:id/xlsx
exports.generatePOXLSX = async (req, res) => {
  try {
    const po  = await loadPO(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

    const buf  = await generateXLSXBuffer(po);
    const safe = po.poNumber.replace(/\//g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=PO-${safe}.xlsx`);
    res.send(buf);
  } catch (error) {
    console.error('PO XLSX error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
