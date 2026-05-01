const prisma = require('../utils/db');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

// Pre-load logo as base64 once at startup
const LOGO_PATH = path.join(__dirname, '../assets/logo.jpg');
const LOGO_B64  = fs.existsSync(LOGO_PATH)
  ? `data:image/jpeg;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`
  : null;

const generatePONumber = async () => {
  const now = new Date();
  const fy = now.getMonth() >= 3
    ? `${String(now.getFullYear()).slice(2)}/${String(now.getFullYear() + 1).slice(2)}`
    : `${String(now.getFullYear() - 1).slice(2)}/${String(now.getFullYear()).slice(2)}`;
  const count = await prisma.purchaseOrder.count();
  return `KVB-${fy}-${String(count + 1).padStart(4, '0')}`;
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

  // Logo cell — embed base64 if available
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
      <th style="${TH}width:36%;border-left:1px solid #003f87;"> </th>
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

// ── XLSX using the master template (correct cell mapping) ─────────────────────
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

  // PO No (J6) and Date (M6 merged M6:N6)
  ws.getCell('J6').value = po.poNumber;
  ws.getCell('M6').value = date;

  // Vendor rows 8-12: template merges I8:J8, I9:J9, etc. — write full label+value to I
  ws.getCell('I8').value  = 'Name Of Company: ' + meta.vendorName;
  ws.getCell('I9').value  = 'GSTIN: ' + meta.vendorGstin;
  ws.getCell('I10').value = 'Address: ' + meta.vendorAddress;
  ws.getCell('I11').value = 'Pin Code: ' + meta.vendorPinCode;
  ws.getCell('I12').value = 'M No: ' + meta.vendorPhone;

  // Ship To rows 8-12: template merges K8:N8, K9:N9, etc. — write to K
  ws.getCell('K8').value  = 'Name Of Company: KVB GREEN ENERGIES';
  ws.getCell('K9').value  = 'GSTIN: 29AAXFK4926A1Z0';
  ws.getCell('K10').value = 'Address: ' + meta.shipAddress;
  ws.getCell('K11').value = 'Pin Code: ' + meta.shipPinCode;
  ws.getCell('K12').value = 'M No: ' + meta.shipMNo;

  // Shipping Method (K14 merged K14:L14) and Delivery Date (M14 merged M14:N14)
  ws.getCell('K14').value = meta.shippingMethod;
  ws.getCell('M14').value = delDate;

  // Clear sample item rows first
  for (let r = 16; r <= 31; r++) {
    ['I', 'J', 'K', 'L', 'M', 'N'].forEach(c => { ws.getCell(`${c}${r}`).value = null; });
  }

  // Write items
  po.items.forEach((item, i) => {
    const r = 16 + i;
    ws.getCell(`I${r}`).value = i + 1;
    ws.getCell(`J${r}`).value = item.itemName + (item.description ? '\n' + item.description : '');
    ws.getCell(`K${r}`).value = item.hsnCode || '';
    ws.getCell(`L${r}`).value = Number(item.quantity);
    ws.getCell(`M${r}`).value = Number(item.unitPrice);
    ws.getCell(`N${r}`).value = Number(item.totalPrice);
  });

  // Fix percentage numFmt on N33 (GST) and N35 (GRAND TOTAL) before writing
  // The template has 0.00% format which would turn 1800 into 180000%
  ws.getCell('N32').numFmt = '#,##0.00';
  ws.getCell('N33').numFmt = '#,##0.00';
  ws.getCell('N34').numFmt = '#,##0.00';
  ws.getCell('N35').numFmt = '#,##0.00';

  // Totals — rows 32-35
  ws.getCell('N32').value = sub;
  ws.getCell('M33').value = `GST @ ${meta.gstRate} %`;
  ws.getCell('N33').value = gstAmt;
  ws.getCell('N34').value = rnd;
  ws.getCell('N35').value = grand;

  // Enforce column widths to prevent ### display
  ws.getColumn('I').width = 8;
  ws.getColumn('J').width = 40;
  ws.getColumn('K').width = 11;
  ws.getColumn('L').width = 7;
  ws.getColumn('M').width = 14;
  ws.getColumn('N').width = 12;

  return await wb.xlsx.writeBuffer();
};

// ── DOCX — pass full HTML to html-to-docx ────────────────────────────────────
const generateDOCXBuffer = async (po) => {
  const htmlToDocx = require('html-to-docx');
  const html = buildPOHTML(po);
  const result = await htmlToDocx(html, null, {
    margins: { top: 400, bottom: 400, left: 600, right: 600 },
    orientation: 'portrait',
    fontSize: 20,
  });
  // html-to-docx returns Buffer or Uint8Array depending on version
  return Buffer.isBuffer(result) ? result : Buffer.from(result);
};

// ─── Controllers ──────────────────────────────────────────────────────────────

// GET /api/purchase
exports.getPurchaseOrders = async (req, res) => {
  try {
    const { status, vendorId, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (search) where.OR = [
      { poNumber: { contains: search } },
    ];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          vendor: { select: { id: true, companyName: true, contactName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          items: { orderBy: { id: 'asc' } },
          _count: { select: { items: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.purchaseOrder.count({ where })
    ]);
    res.json({
      success: true,
      data: orders,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/purchase/:id
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: { orderBy: { id: 'asc' } }
      }
    });
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found' });
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
        itemName: item.itemName,
        description: item.description || null,
        hsnCode: item.hsnCode || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: total
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

    // Find-or-create hidden placeholder vendor (required FK)
    let placeholder = await prisma.vendor.findFirst({ where: { companyName: '__MANUAL_ENTRY__' } });
    if (!placeholder) {
      placeholder = await prisma.vendor.create({
        data: { companyName: '__MANUAL_ENTRY__', contactName: 'Manual', phone: '0000000000' }
      });
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        createdById: req.user.id,
        vendorId: placeholder.id,
        subTotal, taxAmount: gstAmt, totalAmount,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes,
        items: { create: poItems }
      },
      include: {
        items: { orderBy: { id: 'asc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
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

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { id: 'asc' } } }
    });
    if (!existingPO) return res.status(404).json({ success: false, message: 'Purchase order not found' });

    let updateData = {};
    if (status) updateData.status = status;
    if (receivedDate) updateData.receivedDate = new Date(receivedDate);

    if (items && Array.isArray(items)) {
      let subTotal = 0;
      const poItems = items.map(item => {
        const total = item.quantity * item.unitPrice;
        subTotal += total;
        return {
          itemName: item.itemName,
          description: item.description || null,
          hsnCode: item.hsnCode || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: total
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
        subTotal, taxAmount: gstAmt, totalAmount,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes,
        items: {
          deleteMany: {},
          create: poItems
        }
      };
    } else if (req.body.notes !== undefined) {
      updateData.notes = req.body.notes;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: updateData,
      include: { items: { orderBy: { id: 'asc' } } }
    });

    if (status === 'RECEIVED' && existingPO.status !== 'RECEIVED') {
      for (const item of updated.items) {
        if (item.materialId) {
          await prisma.material.update({
            where: { id: item.materialId },
            data: { balance: { increment: item.quantity } }
          });
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
const loadPO = (id) => prisma.purchaseOrder.findUnique({
  where: { id },
  include: {
    vendor: true,
    items: { orderBy: { id: 'asc' } },
    createdBy: { select: { id: true, firstName: true, lastName: true } }
  }
});

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

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    await browser.close();

    await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { pdfUrl: `/uploads/purchase-orders/${safe}.pdf` } });
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
