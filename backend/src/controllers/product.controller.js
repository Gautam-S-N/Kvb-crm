const prisma = require('../utils/db');

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const { search, category, isActive } = req.query;
    
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { hsnCode: { contains: search } },
        { description: { contains: search } }
      ];
    }
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single product
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, data: product });
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
    
    const product = await prisma.product.create({
      data: {
        name,
        description,
        sku,
        hsnCode,
        category,
        unitOfMeasure: unitOfMeasure || 'Units',
        basePrice: parseFloat(basePrice),
        taxRate: taxRate ? parseFloat(taxRate) : 18.00
      }
    });
    
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'SKU already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update product (Admin only)
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (updateData.basePrice) updateData.basePrice = parseFloat(updateData.basePrice);
    if (updateData.taxRate) updateData.taxRate = parseFloat(updateData.taxRate);
    
    const product = await prisma.product.update({
      where: { id },
      data: updateData
    });
    
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete product (Admin only)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};