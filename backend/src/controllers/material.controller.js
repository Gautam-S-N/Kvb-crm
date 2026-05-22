const { eq, and, or, like, asc, desc, sql } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// GET /api/materials
exports.getMaterials = async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 99999 } = req.query;
    
    const conditions = [];
    if (search) {
      conditions.push(
        or(
          like(schema.materials.itemName, `%${search}%`),
          like(schema.materials.itemCode, `%${search}%`),
          like(schema.materials.location, `%${search}%`),
          like(schema.materials.projectSite, `%${search}%`)
        )
      );
    }
    if (category) {
      conditions.push(eq(schema.materials.category, category));
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [materialsList, countResult] = await Promise.all([
      db.select()
        .from(schema.materials)
        .where(whereClause)
        .orderBy(asc(schema.materials.itemCode))
        .limit(parseInt(limit))
        .offset(skip),
      db.select({ count: sql`count(*)` })
        .from(schema.materials)
        .where(whereClause)
    ]);

    const total = countResult[0].count;

    // Manual filter for low stock to preserve logic
    let filteredMaterials = materialsList;
    if (status === 'LOW_STOCK') {
      filteredMaterials = materialsList.filter(m => Number(m.balance) <= Number(m.minQuantity));
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
exports.getStockSummary = async (req, res) => {
  try {
    const { itemCode, itemName } = req.query;
    if (!itemCode && !itemName) {
      return res.status(400).json({ success: false, message: 'itemCode or itemName query param is required' });
    }

    const conditions = [];
    if (itemCode) {
      conditions.push(eq(schema.materials.itemCode, itemCode));
    } else if (itemName) {
      conditions.push(eq(schema.materials.itemName, itemName));
    }

    const records = await db.select()
      .from(schema.materials)
      .where(and(...conditions))
      .orderBy(desc(schema.materials.date));

    if (records.length === 0) {
      return res.json({ success: true, found: false, itemCode, itemName });
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
      itemCode:    records[0].itemCode,
      itemName:    records[0].itemName,
      category:    records[0].category,
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
    const materialList = await db.select()
      .from(schema.materials)
      .where(eq(schema.materials.id, req.params.id))
      .limit(1);
    
    if (materialList.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }
    
    res.json({ success: true, data: materialList[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/materials
exports.createMaterial = async (req, res) => {
  try {
    const { 
      itemName, itemCode, category, unit, minQuantity, 
      rate, inQty, outQty, location, projectSite, remarks, date 
    } = req.body;

    const newInQty  = Number(inQty)  || 0;
    const newOutQty = Number(outQty) || 0;
    const itemRate  = Number(rate)   || 0;
    const calcBalance = newInQty - newOutQty;

    const id = randomUUID();
    const newMaterial = {
      id,
      itemName,
      itemCode: itemCode || null,
      category: category || null,
      unit: unit || 'Nos',
      inQty: parseFloat(newInQty).toFixed(2),
      outQty: parseFloat(newOutQty).toFixed(2),
      balance: parseFloat(calcBalance).toFixed(2),
      minQuantity: minQuantity ? parseFloat(minQuantity).toFixed(2) : '0.00',
      rate: parseFloat(itemRate).toFixed(2),
      totalValue: parseFloat(calcBalance * itemRate).toFixed(2),
      location: location || null,
      projectSite: projectSite || null,
      remarks: remarks || null,
      date: date ? new Date(date) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(schema.materials).values(newMaterial);

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'MATERIALS' });
    }

    res.status(201).json({ success: true, data: newMaterial });
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
    
    const existingList = await db.select()
      .from(schema.materials)
      .where(eq(schema.materials.id, req.params.id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    const qty = Number(balance) || 0;
    const itemRate = Number(rate) || 0;

    const updateData = {
      itemName: itemName !== undefined ? itemName : existingList[0].itemName,
      itemCode: itemCode !== undefined ? itemCode : existingList[0].itemCode,
      category: category !== undefined ? category : existingList[0].category,
      unit: unit || 'Nos',
      inQty: inQty !== undefined ? parseFloat(inQty).toFixed(2) : existingList[0].inQty,
      outQty: outQty !== undefined ? parseFloat(outQty).toFixed(2) : existingList[0].outQty,
      balance: parseFloat(qty).toFixed(2),
      minQuantity: minQuantity !== undefined ? parseFloat(minQuantity).toFixed(2) : existingList[0].minQuantity,
      rate: parseFloat(itemRate).toFixed(2),
      totalValue: parseFloat(qty * itemRate).toFixed(2),
      location: location !== undefined ? location : existingList[0].location,
      projectSite: projectSite !== undefined ? projectSite : existingList[0].projectSite,
      remarks: remarks !== undefined ? remarks : existingList[0].remarks,
      date: date ? new Date(date) : existingList[0].date,
      updatedAt: new Date()
    };

    await db.update(schema.materials)
      .set(updateData)
      .where(eq(schema.materials.id, req.params.id));

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'MATERIALS' });
    }

    res.json({ success: true, data: { ...existingList[0], ...updateData } });
  } catch (error) {
    console.error('UPDATE MATERIAL ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/materials/:id
exports.deleteMaterial = async (req, res) => {
  try {
    const existingList = await db.select()
      .from(schema.materials)
      .where(eq(schema.materials.id, req.params.id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    await db.delete(schema.materials)
      .where(eq(schema.materials.id, req.params.id));
    
    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'MATERIALS' });
    }

    res.json({ success: true, message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/materials/:id/stock
exports.updateStock = async (req, res) => {
  try {
    const { amount, type } = req.body;
    
    const existingList = await db.select()
      .from(schema.materials)
      .where(eq(schema.materials.id, req.params.id))
      .limit(1);
    
    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }
    
    const material = existingList[0];
    let newBalance = Number(material.balance);
    if (type === 'ADD') newBalance += Number(amount);
    else if (type === 'SUBTRACT') newBalance -= Number(amount);
    
    await db.update(schema.materials)
      .set({ balance: parseFloat(newBalance).toFixed(2), updatedAt: new Date() })
      .where(eq(schema.materials.id, req.params.id));
    
    const updated = {
      ...material,
      balance: parseFloat(newBalance).toFixed(2),
      updatedAt: new Date()
    };

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'MATERIALS' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
