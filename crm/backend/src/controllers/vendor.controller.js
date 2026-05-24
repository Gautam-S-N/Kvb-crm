const { eq, and, not, or, like, desc, sql } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// GET /api/vendors
exports.getVendors = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    const whereClause = and(
      not(eq(schema.vendors.companyName, '__MANUAL_ENTRY__')),
      search ? or(
        like(schema.vendors.companyName, `%${search}%`),
        like(schema.vendors.contactName, `%${search}%`),
        like(schema.vendors.phone, `%${search}%`)
      ) : undefined
    );

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [vendorsList, countResult] = await Promise.all([
      db.select({
        id: schema.vendors.id,
        companyName: schema.vendors.companyName,
        contactName: schema.vendors.contactName,
        email: schema.vendors.email,
        phone: schema.vendors.phone,
        address: schema.vendors.address,
        city: schema.vendors.city,
        state: schema.vendors.state,
        pinCode: schema.vendors.pinCode,
        gstNumber: schema.vendors.gstNumber,
        paymentTerms: schema.vendors.paymentTerms,
        isActive: schema.vendors.isActive,
        createdAt: schema.vendors.createdAt,
        updatedAt: schema.vendors.updatedAt,
        purchaseOrdersCount: sql`count(${schema.purchaseOrders.id})`.mapWith(Number),
      })
      .from(schema.vendors)
      .leftJoin(schema.purchaseOrders, eq(schema.vendors.id, schema.purchaseOrders.vendorId))
      .where(whereClause)
      .groupBy(schema.vendors.id)
      .orderBy(desc(schema.vendors.createdAt))
      .limit(parseInt(limit))
      .offset(skip),
      
      db.select({ count: sql`count(*)` })
        .from(schema.vendors)
        .where(whereClause)
    ]);

    const total = countResult[0].count;
    const formattedVendors = vendorsList.map(v => {
      const { purchaseOrdersCount, ...vendorData } = v;
      return {
        ...vendorData,
        _count: { purchaseOrders: purchaseOrdersCount }
      };
    });

    res.json({
      success: true,
      data: formattedVendors,
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

// GET /api/vendors/:id
exports.getVendorById = async (req, res) => {
  try {
    const vendorList = await db.select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, req.params.id))
      .limit(1);

    if (vendorList.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const vendor = vendorList[0];

    const purchaseOrders = await db.select({
      id: schema.purchaseOrders.id,
      poNumber: schema.purchaseOrders.poNumber,
      status: schema.purchaseOrders.status,
      totalAmount: schema.purchaseOrders.totalAmount,
      orderDate: schema.purchaseOrders.orderDate,
    })
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.vendorId, vendor.id))
    .orderBy(desc(schema.purchaseOrders.createdAt))
    .limit(10);

    vendor.purchaseOrders = purchaseOrders;

    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/vendors
exports.createVendor = async (req, res) => {
  try {
    const id = randomUUID();
    const newVendor = {
      id,
      companyName: req.body.companyName,
      contactName: req.body.contactName,
      email: req.body.email || null,
      phone: req.body.phone,
      address: req.body.address || null,
      city: req.body.city || null,
      state: req.body.state || null,
      pinCode: req.body.pinCode || null,
      gstNumber: req.body.gstNumber || null,
      paymentTerms: req.body.paymentTerms || null,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(schema.vendors).values(newVendor);
    res.status(201).json({ success: true, data: newVendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/vendors/:id
exports.updateVendor = async (req, res) => {
  try {
    const existing = await db.select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, req.params.id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const updateData = {
      companyName: req.body.companyName !== undefined ? req.body.companyName : existing[0].companyName,
      contactName: req.body.contactName !== undefined ? req.body.contactName : existing[0].contactName,
      email: req.body.email !== undefined ? req.body.email : existing[0].email,
      phone: req.body.phone !== undefined ? req.body.phone : existing[0].phone,
      address: req.body.address !== undefined ? req.body.address : existing[0].address,
      city: req.body.city !== undefined ? req.body.city : existing[0].city,
      state: req.body.state !== undefined ? req.body.state : existing[0].state,
      pinCode: req.body.pinCode !== undefined ? req.body.pinCode : existing[0].pinCode,
      gstNumber: req.body.gstNumber !== undefined ? req.body.gstNumber : existing[0].gstNumber,
      paymentTerms: req.body.paymentTerms !== undefined ? req.body.paymentTerms : existing[0].paymentTerms,
      isActive: req.body.isActive !== undefined ? req.body.isActive : existing[0].isActive,
      updatedAt: new Date(),
    };

    await db.update(schema.vendors)
      .set(updateData)
      .where(eq(schema.vendors.id, req.params.id));

    res.json({ success: true, data: { ...existing[0], ...updateData } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/vendors/:id
exports.deleteVendor = async (req, res) => {
  try {
    const existing = await db.select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, req.params.id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    await db.delete(schema.vendors)
      .where(eq(schema.vendors.id, req.params.id));

    res.json({ success: true, message: 'Vendor deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
