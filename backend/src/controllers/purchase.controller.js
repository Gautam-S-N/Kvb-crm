const prisma = require('../utils/db');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const generatePONumber = async () => {
  const count = await prisma.purchaseOrder.count();
  return `PO-${String(count + 1).padStart(5, '0')}`;
};

const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };

const buildPOHTML = (po) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Order ${po.poNumber}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,sans-serif; font-size:13px; color:#222; padding:40px; }
    .header { display:flex; justify-content:space-between; border-bottom:3px solid #16a34a; padding-bottom:16px; margin-bottom:20px; }
    .company h1 { font-size:22px; color:#16a34a; font-weight:bold; }
    .doc h2 { font-size:18px; text-align:right; }
    .doc p { text-align:right; color:#555; margin-top:4px; }
    table { width:100%; border-collapse:collapse; margin:20px 0; }
    th { background:#16a34a; color:white; padding:10px; text-align:left; }
    td { padding:10px; border-bottom:1px solid #eee; }
    .totals { text-align:right; margin-top:8px; }
    .grand { font-size:16px; font-weight:bold; color:#16a34a; margin-top:8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company"><h1>KVB Green Energies</h1><p>Purchase Order</p></div>
    <div class="doc"><h2>PURCHASE ORDER</h2><p>${po.poNumber}</p><p>${new Date(po.orderDate).toLocaleDateString('en-IN')}</p></div>
  </div>
  <p><strong>Vendor:</strong> ${po.vendor.companyName} — ${po.vendor.contactName} | ${po.vendor.phone}</p>
  ${po.vendor.gstNumber ? `<p>Vendor GST: ${po.vendor.gstNumber}</p>` : ''}
  ${po.expectedDate ? `<p><strong>Expected Delivery:</strong> ${new Date(po.expectedDate).toLocaleDateString('en-IN')}</p>` : ''}
  <table>
    <thead><tr><th>#</th><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>
      ${po.items.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${item.itemName}</td>
          <td>${item.description || ''}</td>
          <td>${item.quantity}</td>
          <td>₹${Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>₹${Number(item.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div>Sub Total: ₹${Number(po.subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    <div>GST (18%): ₹${Number(po.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    <div class="grand">Grand Total: ₹${Number(po.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
  </div>
  ${po.notes ? `<p style="margin-top:20px"><strong>Notes:</strong> ${po.notes}</p>` : ''}
</body>
</html>
`;

// GET /api/purchase
exports.getPurchaseOrders = async (req, res) => {
  try {
    const { status, vendorId, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (search) where.OR = [
      { poNumber: { contains: search } },
      { vendor: { companyName: { contains: search } } }
    ];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          vendor: { select: { id: true, companyName: true, contactName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
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
        items: true
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
    const { vendorId, items, expectedDate, notes } = req.body;

    let subTotal = 0;
    const poItems = items.map(item => {
      const total = item.quantity * item.unitPrice;
      subTotal += total;
      return { itemName: item.itemName, description: item.description || null, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: total };
    });

    const taxAmount = subTotal * 0.18;
    const totalAmount = subTotal + taxAmount;
    const poNumber = await generatePONumber();

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber, vendorId, createdById: req.user.id,
        subTotal, taxAmount, totalAmount,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes,
        items: { create: poItems }
      },
      include: { vendor: true, items: true, createdBy: { select: { id: true, firstName: true, lastName: true } } }
    });

    res.status(201).json({ success: true, data: po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/purchase/:id
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const { status, notes, receivedDate } = req.body;
    
    // Get PO with items before updating
    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });
    
    if (!existingPO) return res.status(404).json({ success: false, message: 'Purchase order not found' });

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(receivedDate && { receivedDate: new Date(receivedDate) })
      }
    });

    // If status changed to RECEIVED, update material stock
    if (status === 'RECEIVED' && existingPO.status !== 'RECEIVED') {
      for (const item of existingPO.items) {
        if (item.materialId) {
          await prisma.material.update({
            where: { id: item.materialId },
            data: {
              balance: { increment: item.quantity }
            }
          });
        }
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/purchase/:id/pdf
exports.generatePOPDF = async (req, res) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { vendor: true, items: true, createdBy: { select: { id: true, firstName: true, lastName: true } } }
    });
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

    const html = buildPOHTML(po);
    const dir = path.join(__dirname, '../../uploads/purchase-orders');
    ensureDir(dir);
    const filePath = path.join(dir, `${po.poNumber}.pdf`);

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    await browser.close();

    await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { pdfUrl: `/uploads/purchase-orders/${po.poNumber}.pdf` } });
    res.download(filePath, `PO-${po.poNumber}.pdf`);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
