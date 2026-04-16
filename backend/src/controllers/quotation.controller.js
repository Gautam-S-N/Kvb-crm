const prisma = require('../utils/db');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Generate quotation number
const generateQuotationNumber = async () => {
  const count = await prisma.quotation.count();
  return `Q-${String(count + 1).padStart(5, '0')}`;
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
          lead: {
            select: { leadNumber: true, title: true }
          },
          customer: {
            select: { contactName: true, companyName: true }
          },
          createdBy: {
            select: { firstName: true, lastName: true }
          },
          _count: {
            select: { items: true }
          }
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
        createdBy: {
          select: { firstName: true, lastName: true, email: true }
        },
        items: {
          include: {
            product: true
          }
        }
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

// Create quotation
exports.createQuotation = async (req, res) => {
  try {
    const {
      leadId,
      items,
      discountAmount,
      discountPercent,
      validUntil,
      paymentTerms,
      deliveryTerms,
      notes,
      termsConditions
    } = req.body;
    
    // Get lead details
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { customer: true }
    });
    
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Calculate totals
    let subTotal = 0;
    const quotationItems = items.map(item => {
      const totalPrice = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      subTotal += totalPrice;
      return {
        productId: item.productId,
        description: item.description, // Customer-specific description
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        taxRate: item.taxRate || 18,
        totalPrice
      };
    });
    
    // Apply overall discount
    const discountAmt = discountAmount || (subTotal * (discountPercent || 0) / 100);
    const taxableAmount = subTotal - discountAmt;
    const taxAmount = taxableAmount * 0.18; // 18% GST
    const totalAmount = taxableAmount + taxAmount;
    
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
        items: {
          create: quotationItems
        }
      },
      include: {
        items: {
          include: { product: true }
        },
        customer: true,
        lead: true
      }
    });
    
    // Update lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'QUOTATION_SENT' }
    });
    
    // Create timeline entry
    await prisma.leadTimeline.create({
      data: {
        leadId,
        action: 'Quotation Created',
        description: `Quotation ${quotationNumber} created with total value ₹${totalAmount.toLocaleString()}`,
        performedBy: req.user.id
      }
    });
    
    res.status(201).json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate PDF
exports.generatePDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true }
        },
        customer: true,
        lead: true,
        createdBy: {
          select: { firstName: true, lastName: true }
        }
      }
    });
    
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    
    // Generate HTML for PDF (matches professional Invoice.docx format)
    const taxableAmount = Number(quotation.subTotal) - Number(quotation.discountAmount);
    const cgst = Number(quotation.taxAmount) / 2;
    const sgst = Number(quotation.taxAmount) / 2;

    const itemsRows = quotation.items.map((item, i) => {
      const itemTaxable = Number(item.totalPrice);
      return `
        <tr>
          <td style="text-align:center;border:1px solid #999;padding:6px 4px;">${i + 1}</td>
          <td style="border:1px solid #999;padding:6px 4px;">
            <strong>${item.product.name}</strong>
            ${(item.description || item.product.description) ? `<br/><small style="color:#555">${item.description || item.product.description}</small>` : ''}
          </td>
          <td style="border:1px solid #999;padding:6px 4px;text-align:center;">${item.product.hsnCode || ''}</td>
          <td style="border:1px solid #999;padding:6px 4px;text-align:center;">${Number(item.quantity)} ${item.product.unitOfMeasure}</td>
          <td style="border:1px solid #999;padding:6px 4px;text-align:right;">₹${Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="border:1px solid #999;padding:6px 4px;text-align:center;">${item.product.unitOfMeasure}</td>
          <td style="border:1px solid #999;padding:6px 4px;text-align:right;">₹${itemTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quotation ${quotation.quotationNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px 32px; }
    .outer-border { border: 2px solid #333; }
    .title-bar { text-align: center; font-size: 16px; font-weight: bold; border-bottom: 2px solid #333; padding: 6px 0; letter-spacing: 1px; }
    .top-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #777; }
    .company-block { padding: 10px 12px; border-right: 1px solid #777; }
    .company-block .name { font-size: 15px; font-weight: bold; color: #15803d; }
    .company-block p { margin-top: 3px; line-height: 1.5; }
    .meta-block { padding: 0; }
    .meta-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #aaa; }
    .meta-row:last-child { border-bottom: none; }
    .meta-cell { padding: 5px 8px; font-size: 11px; border-right: 1px solid #aaa; }
    .meta-cell:last-child { border-right: none; }
    .meta-label { font-weight: bold; color: #444; font-size: 10px; display: block; }
    .meta-value { font-size: 11px; }
    .buyer-dispatch-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #777; }
    .buyer-block { padding: 10px 12px; border-right: 1px solid #777; }
    .buyer-block .label { font-size: 10px; font-weight: bold; color: #444; text-transform: uppercase; margin-bottom: 4px; }
    .section-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #777; }
    .section-table th { background: #d1fae5; color: #14532d; padding: 7px 6px; border: 1px solid #999; font-size: 11px; text-align: center; }
    .section-table td { padding: 6px; border: 1px solid #999; vertical-align: top; font-size: 11px; }
    .total-row td { font-weight: bold; background: #f0fdf4; }
    .words-row { padding: 8px 12px; border-bottom: 1px solid #777; font-size: 11px; }
    .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; min-height: 120px; }
    .declaration-block { padding: 10px 12px; border-right: 1px solid #777; font-size: 10.5px; line-height: 1.6; }
    .declaration-block .dec-title { font-weight: bold; margin-bottom: 4px; }
    .bank-block { padding: 10px 12px; font-size: 10.5px; line-height: 1.7; }
    .bank-block .bank-title { font-weight: bold; margin-bottom: 4px; }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #777; }
    .sig-cell { padding: 10px 12px; font-size: 11px; border-right: 1px solid #777; min-height: 70px; display: flex; align-items: flex-end; }
    .sig-cell:last-child { border-right: none; justify-content: flex-end; }
  </style>
</head>
<body>
<div class="outer-border">
  <div class="title-bar">QUOTATION</div>
  <div class="top-grid">
    <div class="company-block">
      <div class="name">KVB Green Energies</div>
      <p>R16, KSSIDC, 3rd Cross, Belur Industrial Estate,<br>Dharwad – 580011, Karnataka, India</p>
      <p>Phone: +91 95455 29950, +91 74118 93555</p>
      <p>GSTIN: 29AAGFK7890M1ZX</p>
      <p>State: Karnataka</p>
    </div>
    <div class="meta-block">
      <div class="meta-row">
        <div class="meta-cell">
          <span class="meta-label">Quotation No.</span>
          <span class="meta-value">${quotation.quotationNumber}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">Dated</span>
          <span class="meta-value">${new Date(quotation.quotationDate).toLocaleDateString('en-IN')}</span>
        </div>
      </div>
      <div class="meta-row">
        <div class="meta-cell">
          <span class="meta-label">Valid Until</span>
          <span class="meta-value">${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-IN') : '—'}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">Lead Reference</span>
          <span class="meta-value">${quotation.lead.leadNumber}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="buyer-dispatch-grid">
    <div class="buyer-block">
      <div class="label">Customer (Bill to)</div>
      <p><strong>${quotation.customer.contactName}</strong></p>
      ${quotation.customer.companyName ? `<p>${quotation.customer.companyName}</p>` : ''}
      <p>Ph: ${quotation.customer.phone}</p>
      ${quotation.customer.email ? `<p>Email: ${quotation.customer.email}</p>` : ''}
    </div>
    <div class="buyer-block" style="border-right: none;">
      <div class="label">Payment & Delivery Terms</div>
      ${quotation.paymentTerms ? `<p><strong>Payment:</strong> ${quotation.paymentTerms}</p>` : ''}
      ${quotation.deliveryTerms ? `<p><strong>Delivery:</strong> ${quotation.deliveryTerms}</p>` : ''}
    </div>
  </div>

  <table class="section-table">
    <thead>
      <tr>
        <th style="width:5%">Sl No.</th>
        <th style="width:30%">Description of Goods</th>
        <th style="width:10%">HSN/SAC</th>
        <th style="width:12%">Quantity</th>
        <th style="width:13%">Rate</th>
        <th style="width:8%">Per</th>
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
        <td style="text-align:right;"><strong>₹${Number(quotation.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="words-row">
    <strong>Total Quotation Value (in words):</strong>
    &nbsp;Rupees <em>${quotation.totalAmount.toLocaleString('en-IN')} Only</em>
  </div>

  <div class="bottom-grid">
    <div class="declaration-block">
      <div class="dec-title">Terms & Conditions</div>
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
    <div class="sig-cell">Accepted By (Name & Signature)</div>
    <div class="sig-cell" style="flex-direction:column;align-items:flex-end;">
      <p>for <strong>KVB Green Energies</strong></p>
      <br/><br/><br/>
      <p><strong>${quotation.createdBy.firstName} ${quotation.createdBy.lastName}</strong></p>
      <p>Authorised Signatory</p>
    </div>
  </div>
</div>
</body>
</html>`;
    
    // Generate PDF with Puppeteer
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfPath = path.join(__dirname, '../../uploads/quotations', `${quotation.quotationNumber}.pdf`);
    
    // Ensure directory exists
    if (!fs.existsSync(path.dirname(pdfPath))) {
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    }
    
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true
    });
    
    await browser.close();
    
    // Update quotation with PDF URL
    await prisma.quotation.update({
      where: { id },
      data: { pdfUrl: `/uploads/quotations/${quotation.quotationNumber}.pdf` }
    });
    
    res.download(pdfPath, `Quotation-${quotation.quotationNumber}.pdf`);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Convert quotation to sale — actually creates a Sale record
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
      // Already converted — return the linked saleId if available
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

    // Check if the sale was already partially created in a previous failed attempt
    let sale = await prisma.sale.findUnique({
      where: { quotationId: quotation.id }
    });

    if (!sale) {
      // Generate sale number
      const saleCount = await prisma.sale.count();
      const saleNumber = `INV-${String(saleCount + 1).padStart(5, '0')}`;

      // Build sale items from quotation items
      const saleItems = quotation.items.map(item => ({
        productId: item.productId,
        description: item.description || null,
        quantity:   Number(item.quantity),
        unitPrice:  Number(item.unitPrice),
        discount:   Number(item.discount)   || 0,
        taxRate:    Number(item.taxRate)    || 18,
        totalPrice: Number(item.totalPrice),
      }));

      // Create the Sale record linked to this quotation
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


    // Mark quotation as converted and link to the new sale
    await prisma.quotation.update({
      where: { id },
      data: {
        status: 'CONVERTED_TO_SALE',
        sale: { connect: { id: sale.id } }
      }
    });

    // Update lead status
    await prisma.lead.update({
      where: { id: quotation.leadId },
      data: { status: 'ORDER_CONFIRMED' }
    });

    // Timeline entry
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