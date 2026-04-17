const prisma = require('../utils/db');

// GET /api/vendors
exports.getVendors = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    const where = { NOT: { companyName: '__MANUAL_ENTRY__' } };
    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { contactName: { contains: search } },
        { phone:       { contains: search } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: { _count: { select: { purchaseOrders: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.vendor.count({ where })
    ]);

    res.json({
      success: true,
      data: vendors,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/vendors/:id
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, poNumber: true, status: true, totalAmount: true, orderDate: true }
        }
      }
    });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/vendors
exports.createVendor = async (req, res) => {
  try {
    const vendor = await prisma.vendor.create({ data: req.body });
    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/vendors/:id
exports.updateVendor = async (req, res) => {
  try {
    const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/vendors/:id
exports.deleteVendor = async (req, res) => {
  try {
    await prisma.vendor.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Vendor deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
