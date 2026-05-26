const { eq, and, or, like, asc, desc, sql } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// GET /api/material-catalog
exports.getMaterials = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 1000 } = req.query;
    
    const conditions = [];
    if (search) {
      conditions.push(
        or(
          like(schema.materialCatalog.itemName, `%${search}%`),
          like(schema.materialCatalog.itemCode, `%${search}%`),
          like(schema.materialCatalog.location, `%${search}%`),
          like(schema.materialCatalog.projectSite, `%${search}%`)
        )
      );
    }
    if (category) {
      conditions.push(eq(schema.materialCatalog.category, category));
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [materialsList, countResult] = await Promise.all([
      db.select()
        .from(schema.materialCatalog)
        .where(whereClause)
        .orderBy(asc(schema.materialCatalog.itemCode))
        .limit(parseInt(limit))
        .offset(skip),
      db.select({ count: sql`count(*)` })
        .from(schema.materialCatalog)
        .where(whereClause)
    ]);

    const total = countResult[0].count;

    res.json({
      success: true,
      data: materialsList,
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

// GET /api/material-catalog/:id
exports.getMaterialById = async (req, res) => {
  try {
    const materialList = await db.select()
      .from(schema.materialCatalog)
      .where(eq(schema.materialCatalog.id, req.params.id))
      .limit(1);
    
    if (materialList.length === 0) {
      return res.status(404).json({ success: false, message: 'Catalog item not found' });
    }
    
    res.json({ success: true, data: materialList[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/material-catalog
exports.createMaterial = async (req, res) => {
  try {
    const { 
      itemName, itemCode, category, unit, rate, location, projectSite, remarks 
    } = req.body;

    const itemRate = Number(rate) || 0;
    const id = randomUUID();
    const newMaterial = {
      id,
      itemName,
      itemCode: itemCode || null,
      category: category || null,
      unit: unit || 'Nos',
      rate: parseFloat(itemRate).toFixed(2),
      location: location || null,
      projectSite: projectSite || null,
      remarks: remarks || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(schema.materialCatalog).values(newMaterial);

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'MATERIAL_CATALOG' });
    }

    res.status(201).json({ success: true, data: newMaterial });
  } catch (error) {
    console.error('CREATE CATALOG MATERIAL ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/material-catalog/:id
exports.updateMaterial = async (req, res) => {
  try {
    const { 
      itemName, itemCode, category, unit, rate, location, projectSite, remarks 
    } = req.body;
    
    const existingList = await db.select()
      .from(schema.materialCatalog)
      .where(eq(schema.materialCatalog.id, req.params.id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'Catalog item not found' });
    }

    const itemRate = Number(rate) || 0;

    const updateData = {
      itemName: itemName !== undefined ? itemName : existingList[0].itemName,
      itemCode: itemCode !== undefined ? itemCode : existingList[0].itemCode,
      category: category !== undefined ? category : existingList[0].category,
      unit: unit || 'Nos',
      rate: parseFloat(itemRate).toFixed(2),
      location: location !== undefined ? location : existingList[0].location,
      projectSite: projectSite !== undefined ? projectSite : existingList[0].projectSite,
      remarks: remarks !== undefined ? remarks : existingList[0].remarks,
      updatedAt: new Date()
    };

    await db.update(schema.materialCatalog)
      .set(updateData)
      .where(eq(schema.materialCatalog.id, req.params.id));

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'MATERIAL_CATALOG' });
    }

    res.json({ success: true, data: { ...existingList[0], ...updateData } });
  } catch (error) {
    console.error('UPDATE CATALOG MATERIAL ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/material-catalog/:id
exports.deleteMaterial = async (req, res) => {
  try {
    const existingList = await db.select()
      .from(schema.materialCatalog)
      .where(eq(schema.materialCatalog.id, req.params.id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'Catalog item not found' });
    }

    await db.delete(schema.materialCatalog)
      .where(eq(schema.materialCatalog.id, req.params.id));
    
    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'MATERIAL_CATALOG' });
    }

    res.json({ success: true, message: 'Catalog item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
