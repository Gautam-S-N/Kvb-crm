const { eq, and, or, like, asc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const { search, category, isActive } = req.query;
    
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(schema.products.name, `%${search}%`),
          like(schema.products.sku, `%${search}%`),
          like(schema.products.hsnCode, `%${search}%`),
          like(schema.products.description, `%${search}%`)
        )
      );
    }
    
    if (category) {
      conditions.push(eq(schema.products.category, category));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(schema.products.isActive, isActive === 'true'));
    }
    
    const productsList = await db.select()
      .from(schema.products)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(schema.products.name));
    
    res.json({ success: true, data: productsList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single product
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const productsList = await db.select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);
    
    if (productsList.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, data: productsList[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create product (Admin only)
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      sku,
      hsnCode,
      category,
      unitOfMeasure,
      basePrice,
      taxRate
    } = req.body;

    // Check unique SKU
    const existingSku = await db.select()
      .from(schema.products)
      .where(eq(schema.products.sku, sku))
      .limit(1);

    if (existingSku.length > 0) {
      return res.status(400).json({ success: false, message: 'SKU already exists' });
    }
    
    const id = randomUUID();
    const newProduct = {
      id,
      name,
      description: description || null,
      sku,
      hsnCode: hsnCode || null,
      category: category || null,
      unitOfMeasure: unitOfMeasure || 'Units',
      basePrice: parseFloat(basePrice).toFixed(2),
      taxRate: taxRate ? parseFloat(taxRate).toFixed(2) : '18.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(schema.products).values(newProduct);
    
    res.status(201).json({ success: true, data: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update product (Admin only)
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingList = await db.select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const updateData = { ...req.body };
    
    if (updateData.basePrice !== undefined) {
      updateData.basePrice = parseFloat(updateData.basePrice).toFixed(2);
    }
    if (updateData.taxRate !== undefined) {
      updateData.taxRate = parseFloat(updateData.taxRate).toFixed(2);
    }
    updateData.updatedAt = new Date();
    
    await db.update(schema.products)
      .set(updateData)
      .where(eq(schema.products.id, id));

    res.json({ success: true, data: { ...existingList[0], ...updateData } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete product (Admin only)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existingList = await db.select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await db.delete(schema.products)
      .where(eq(schema.products.id, id));

    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};