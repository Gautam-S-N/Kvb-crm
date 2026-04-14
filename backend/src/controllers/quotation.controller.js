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
    
    // Generate HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Quotation ${quotation.quotationNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; border-bottom: 3px solid #16a34a; padding-bottom: 20px; margin-bottom: 30px; }
          .company-name { font-size: 28px; font-weight: bold; color: #16a34a; }
          .doc-title { font-size: 24px; margin-top: 10px; }
          .info-section { margin-bottom: 20px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .label { font-weight: bold; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #16a34a; color: white; padding: 12px; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #ddd; }
          .total-section { margin-top: 30px; text-align: right; }
      .total-row { margin-bottom: 5px; }
          .grand-total { font-size: 20px; font-weight: bold; color: #16a34a; margin-top: 10px; }
          .terms { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
          .signature { margin-top: 60px; text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">KVB Green Energies</div>
          <div>Your trusted partner in renewable energy solutions</div>
          <div class="doc-title">QUOTATION</div>
        </div>
        
        <div class="info-section">
          <div class="info-row">
            <div><span class="label">Quotation #:</span> ${quotation.quotationNumber}</div>
            <div><span class="label">Date:</span> ${new Date(quotation.quotationDate).toLocaleDateString()}</div>
          </div>
          <div class="info-row">
            <div><span class="label">Valid Until:</span> ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}</div>
            <div><span class="label">Lead:</span> ${quotation.lead.leadNumber}</div>
          </div>
        </div>
        
        <div class="info-section">
          <div class="label">To:</div>
          <div>${quotation.customer.contactName}</div>
          ${quotation.customer.companyName ? `<div>${quotation.customer.companyName}</div>` : ''}
          <div>${quotation.customer.phone}</div>
          ${quotation.customer.email ? `<div>${quotation.customer.email}</div>` : ''}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product/Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${quotation.items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <strong>${item.product.name}</strong><br/>
                  <small>${item.description || item.product.description || ''}</small>
                </td>
                <td>${item.quantity} ${item.product.unitOfMeasure}</td>
                <td>₹${item.unitPrice.toLocaleString()}</td>
                <td>${item.discount}%</td>
                <td>${item.taxRate}%</td>
                <td>₹${item.totalPrice.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="total-row"><span class="label">Sub Total:</span> ₹${quotation.subTotal.toLocaleString()}</div>
          ${quotation.discountAmount > 0 ? `<div class="total-row"><span class="label">Discount:</span> -₹${quotation.discountAmount.toLocaleString()}</div>` : ''}
          <div class="total-row"><span class="label">Taxable Amount:</span> ₹${(quotation.subTotal - quotation.discountAmount).toLocaleString()}</div>
          <div class="total-row"><span class="label">GST (18%):</span> ₹${quotation.taxAmount.toLocaleString()}</div>
          <div class="grand-total">Grand Total: ₹${quotation.totalAmount.toLocaleString()}</div>
        </div>
        
        ${quotation.paymentTerms ? `
          <div class="terms">
            <div class="label">Payment Terms:</div>
            <div>${quotation.paymentTerms}</div>
          </div>
        ` : ''}
        
        ${quotation.deliveryTerms ? `
          <div class="terms">
            <div class="label">Delivery Terms:</div>
            <div>${quotation.deliveryTerms}</div>
          </div>
        ` : ''}
        
        ${quotation.termsConditions ? `
          <div class="terms">
            <div class="label">Terms & Conditions:</div>
            <div>${quotation.termsConditions}</div>
          </div>
        ` : ''}
        
        <div class="signature">
          <div>Authorized Signatory</div>
          <div style="margin-top: 10px;">${quotation.createdBy.firstName} ${quotation.createdBy.lastName}</div>
          <div style="margin-top: 40px; border-top: 1px solid #333; width: 200px; display: inline-block;"></div>
        </div>
      </body>
      </html>
    `;
    
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