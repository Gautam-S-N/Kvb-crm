const prisma = require('../utils/db');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateSaleNumber = async () => {
  const count = await prisma.sale.count();
  return `INV-${String(count + 1).padStart(5, '0')}`;
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

// ─── Invoice HTML Template ────────────────────────────────────────────────────
const buildInvoiceHTML = (sale) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${sale.saleNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #16a34a; padding-bottom: 20px; margin-bottom: 24px; }
    .company h1 { font-size: 24px; color: #16a34a; font-weight: bold; }
    .company p { color: #555; margin-top: 4px; }
    .doc-info { text-align: right; }
    .doc-info h2 { font-size: 20px; font-weight: bold; color: #333; }
    .doc-info p { color: #555; margin-top: 4px; }
    .badge { display: inline-block; background: #16a34a; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; margin-top: 6px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 20px; }
    .party-box { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px; }
    .party-box h4 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: 0.05em; }
    .party-box p { line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { background: #16a34a; color: white; padding: 10px 12px; text-align: left; font-size: 12px; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .item-name { font-weight: 600; }
    .item-desc { color: #6b7280; font-size: 11px; margin-top: 3px; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 20px; }
    .totals-table { width: 280px; }
    .totals-table tr td { padding: 5px 0; }
    .totals-table tr td:last-child { text-align: right; font-weight: 500; }
    .grand-total td { font-size: 15px; font-weight: bold; color: #16a34a; border-top: 2px solid #16a34a; padding-top: 8px !important; }
    .amount-words { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-style: italic; color: #166534; }
    .payment-info { margin-bottom: 20px; }
    .payment-info h4 { font-weight: 600; margin-bottom: 8px; }
    .payment-status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-paid { background: #dcfce7; color: #16a34a; }
    .status-partial { background: #fef9c3; color: #92400e; }
    .status-unpaid { background: #fee2e2; color: #dc2626; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .terms p { color: #6b7280; font-size: 11px; line-height: 1.6; }
    .signature { text-align: right; }
    .signature-line { border-top: 1px solid #333; width: 180px; margin-top: 50px; display: inline-block; }
    .signature p { font-size: 12px; color: #555; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      <h1>KVB Green Energies</h1>
      <p>Your trusted partner in renewable energy solutions</p>
      <p>GST: GSTIN12345678 | support@kvbgreenenergies.com</p>
    </div>
    <div class="doc-info">
      <h2>TAX INVOICE</h2>
      <p><strong>Invoice #:</strong> ${sale.saleNumber}</p>
      <p><strong>Date:</strong> ${new Date(sale.saleDate).toLocaleDateString('en-IN')}</p>
      ${sale.expectedDelivery ? `<p><strong>Delivery:</strong> ${new Date(sale.expectedDelivery).toLocaleDateString('en-IN')}</p>` : ''}
      <span class="badge">${sale.paymentStatus}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party-box">
      <h4>Bill From</h4>
      <p><strong>KVB Green Energies</strong></p>
      <p>Renewable Energy Solutions</p>
      <p>India</p>
    </div>
    <div class="party-box">
      <h4>Bill To</h4>
      <p><strong>${sale.customer.contactName}</strong></p>
      ${sale.customer.companyName ? `<p>${sale.customer.companyName}</p>` : ''}
      <p>${sale.customer.phone}</p>
      ${sale.customer.email ? `<p>${sale.customer.email}</p>` : ''}
      ${sale.customer.gstNumber ? `<p>GST: ${sale.customer.gstNumber}</p>` : ''}
      ${sale.customer.city ? `<p>${sale.customer.city}${sale.customer.state ? ', ' + sale.customer.state : ''}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th width="5%">#</th>
        <th width="35%">Product / Description</th>
        <th width="10%">Qty</th>
        <th width="15%">Unit Price</th>
        <th width="10%">Disc %</th>
        <th width="10%">GST %</th>
        <th width="15%">Total</th>
      </tr>
    </thead>
    <tbody>
      ${sale.items.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>
            <div class="item-name">${item.product.name}</div>
            ${(item.description || item.product.description) ? `<div class="item-desc">${item.description || item.product.description}</div>` : ''}
          </td>
          <td>${item.quantity} ${item.product.unitOfMeasure}</td>
          <td>₹${Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>${item.discount}%</td>
          <td>${item.taxRate}%</td>
          <td>₹${Number(item.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr><td>Sub Total</td><td>₹${Number(sale.subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      ${Number(sale.discountAmount) > 0 ? `<tr><td>Discount</td><td>-₹${Number(sale.discountAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      <tr><td>Taxable Amount</td><td>₹${(Number(sale.subTotal) - Number(sale.discountAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td>CGST (9%)</td><td>₹${(Number(sale.taxAmount) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td>SGST (9%)</td><td>₹${(Number(sale.taxAmount) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      <tr class="grand-total"><td><strong>Grand Total</strong></td><td><strong>₹${Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td></tr>
    </table>
  </div>

  <div class="amount-words">
    Amount in Words: <strong>Rupees ${inWords(Math.round(Number(sale.totalAmount)))} Only</strong>
  </div>

  ${sale.notes ? `<div style="margin-bottom: 16px;"><strong>Notes:</strong> <span style="color:#555">${sale.notes}</span></div>` : ''}
  ${sale.paymentTerms ? `<div style="margin-bottom: 16px;"><strong>Payment Terms:</strong> <span style="color:#555">${sale.paymentTerms}</span></div>` : ''}

  <div class="footer">
    <div class="terms">
      <p>Thank you for your business!</p>
      <p>This is a computer-generated invoice and does not require a physical signature.</p>
    </div>
    <div class="signature">
      <div class="signature-line"></div>
      <p><strong>${sale.createdBy.firstName} ${sale.createdBy.lastName}</strong></p>
      <p>Authorized Signatory</p>
    </div>
  </div>
</body>
</html>
`;

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
    // append them to notes so they appear on the invoice
    let fullNotes = notes || '';
    if (paymentTerms) fullNotes += (fullNotes ? '\n' : '') + `Payment Terms: ${paymentTerms}`;
    if (expectedDelivery) fullNotes += (fullNotes ? '\n' : '') + `Expected Delivery: ${new Date(expectedDelivery).toLocaleDateString('en-IN')}`;

    const sale = await prisma.sale.create({
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

    // Mark quotation as converted
    if (quotationId) {
      await prisma.quotation.update({
        where: { id: quotationId },
        data: { status: 'CONVERTED_TO_SALE', saleId: sale.id }
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (error) {
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
        payments: true
      }
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const html = buildInvoiceHTML(sale);

    const invoiceDir = path.join(__dirname, '../../uploads/invoices');
    ensureDir(invoiceDir);
    const invoicePath = path.join(invoiceDir, `${sale.saleNumber}.pdf`);

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
      data: { invoiceUrl: `/uploads/invoices/${sale.saleNumber}.pdf` }
    });

    res.download(invoicePath, `Invoice-${sale.saleNumber}.pdf`);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
