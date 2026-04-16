const prisma = require('../utils/db');

// GET /api/materials
exports.getMaterials = async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 100 } = req.query;
    
    const where = {};
    if (search) {
      where.OR = [
        { itemName: { contains: search } },
        { itemCode: { contains: search } },
        { location: { contains: search } },
        { projectSite: { contains: search } }
      ];
    }
    if (category) where.category = category;
    
    // Low stock filter logic
    // Note: Prisma doesn't support col-to-col comparison in where clause easily,
    // so we'll fetch and filter in JS for now or use raw query later.
    // Removing the invalid where.quantity assignment.

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        orderBy: { itemName: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.material.count({ where })
    ]);

    // Manual filter for low stock
    let filteredMaterials = materials;
    if (status === 'LOW_STOCK') {
      filteredMaterials = materials.filter(m => Number(m.balance) <= Number(m.minQuantity));
    }

    res.json({
      success: true,
      data: filteredMaterials,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/materials/stock-summary?itemCode=SP-400
// Aggregates total stock in hand across ALL records sharing the same item code
exports.getStockSummary = async (req, res) => {
  try {
    const { itemCode } = req.query;
    if (!itemCode) {
      return res.status(400).json({ success: false, message: 'itemCode query param is required' });
    }

    const records = await prisma.material.findMany({
      where: { itemCode },
      orderBy: { date: 'desc' }
    });

    if (records.length === 0) {
      return res.json({ success: true, found: false, itemCode });
    }

    const totalStock  = records.reduce((s, r) => s + Number(r.balance), 0);
    const totalInQty  = records.reduce((s, r) => s + Number(r.inQty),   0);
    const totalOutQty = records.reduce((s, r) => s + Number(r.outQty),  0);

    const breakdown = records.map(r => ({
      id:          r.id,
      itemName:    r.itemName,
      location:    r.location    || 'N/A',
      projectSite: r.projectSite || 'General',
      inQty:       Number(r.inQty),
      outQty:      Number(r.outQty),
      balance:     Number(r.balance),
      unit:        r.unit,
      date:        r.date,
    }));

    return res.json({
      success: true,
      found: true,
      itemCode,
      itemName:    records[0].itemName,
      unit:        records[0].unit,
      totalInQty,
      totalOutQty,
      totalStock,
      recordCount: records.length,
      breakdown,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/materials/:id
exports.getMaterialById = async (req, res) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id }
    });
    
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }
    
    res.json({ success: true, data: material });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/materials
exports.createMaterial = async (req, res) => {
  try {
    const { 
      itemName, itemCode, category, unit, balance, minQuantity, 
      rate, inQty, outQty, location, projectSite, remarks, date 
    } = req.body;

    const newInQty  = Number(inQty)  || 0;
    const newOutQty = Number(outQty) || 0;
    const itemRate  = Number(rate)   || 0;
    const calcBalance = newInQty - newOutQty;

    const material = await prisma.material.create({
      data: {
        itemName,
        itemCode:    itemCode || undefined,
        category,
        unit:        unit || 'Nos',
        inQty:       newInQty,
        outQty:      newOutQty,
        balance:     calcBalance,
        minQuantity: Number(minQuantity) || 0,
        rate:        itemRate,
        totalValue:  calcBalance * itemRate,
        location,
        projectSite,
        remarks,
        date:        date ? new Date(date) : new Date()
      }
    });

    res.status(201).json({ success: true, data: material });
  } catch (error) {
    console.error('CREATE MATERIAL ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/materials/:id
exports.updateMaterial = async (req, res) => {
  console.log('UPDATE MATERIAL REQUEST:', req.params.id, req.body);
  try {
    const { 
      itemName, itemCode, category, unit, balance, minQuantity, 
      rate, inQty, outQty, location, projectSite, remarks, date 
    } = req.body;
    
    const qty = Number(balance) || 0;
    const itemRate = Number(rate) || 0;

    const material = await prisma.material.update({
      where: { id: req.params.id },
      data: {
        itemName,
        itemCode,
        category,
        unit: unit || 'Nos',
        inQty: Number(inQty) || 0,
        outQty: Number(outQty) || 0,
        balance: qty,
        minQuantity: Number(minQuantity) || 0,
        rate: itemRate,
        totalValue: qty * itemRate,
        location,
        projectSite,
        remarks,
        date: date ? new Date(date) : undefined
      }
    });

    res.json({ success: true, data: material });
  } catch (error) {
    console.error('UPDATE MATERIAL ERROR:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Item Code already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/materials/:id
exports.deleteMaterial = async (req, res) => {
  try {
    await prisma.material.delete({
      where: { id: req.params.id }
    });
    
    res.json({ success: true, message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/materials/:id/stock
exports.updateStock = async (req, res) => {
  try {
    const { amount, type } = req.body; // type: 'ADD' or 'SUBTRACT'
    
    const material = await prisma.material.findUnique({
      where: { id: req.params.id }
    });
    
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }
    
    let newBalance = Number(material.balance);
    if (type === 'ADD') newBalance += Number(amount);
    else if (type === 'SUBTRACT') newBalance -= Number(amount);
    
    const updated = await prisma.material.update({
      where: { id: req.params.id },
      data: { balance: newBalance }
    });
    
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
