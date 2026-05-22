const prisma = require('../utils/db');

// Create a new purchase item
const createPurchaseItem = async (req, res) => {
  try {
    const { name, hsnCode, description, unit, rate, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const item = await prisma.purchaseItem.create({
      data: {
        name,
        hsnCode,
        description,
        unit: unit || 'Nos',
        rate: rate ? parseFloat(rate) : 0,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Purchase item created successfully',
      data: item
    });
  } catch (error) {
    console.error('Error creating purchase item:', error);
    res.status(500).json({ error: 'Failed to create purchase item' });
  }
};

// Get all purchase items
const getPurchaseItems = async (req, res) => {
  try {
    const { search, activeOnly } = req.query;
    
    let whereClause = {};
    
    if (activeOnly === 'true') {
      whereClause.isActive = true;
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { hsnCode: { contains: search } }
      ];
    }

    const items = await prisma.purchaseItem.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });

    res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching purchase items:', error);
    res.status(500).json({ error: 'Failed to fetch purchase items' });
  }
};

// Get single purchase item
const getPurchaseItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await prisma.purchaseItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Purchase item not found' });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching purchase item:', error);
    res.status(500).json({ error: 'Failed to fetch purchase item' });
  }
};

// Update purchase item
const updatePurchaseItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, hsnCode, description, unit, rate, isActive } = req.body;

    const existingItem = await prisma.purchaseItem.findUnique({
      where: { id }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Purchase item not found' });
    }

    const updatedItem = await prisma.purchaseItem.update({
      where: { id },
      data: {
        name,
        hsnCode,
        description,
        unit,
        rate: rate ? parseFloat(rate) : undefined,
        isActive
      }
    });

    res.status(200).json({
      success: true,
      message: 'Purchase item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    console.error('Error updating purchase item:', error);
    res.status(500).json({ error: 'Failed to update purchase item' });
  }
};

// Delete purchase item
const deletePurchaseItem = async (req, res) => {
  try {
    const { id } = req.params;

    const existingItem = await prisma.purchaseItem.findUnique({
      where: { id }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Purchase item not found' });
    }

    await prisma.purchaseItem.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Purchase item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting purchase item:', error);
    res.status(500).json({ error: 'Failed to delete purchase item. It may be associated with existing purchase orders.' });
  }
};

module.exports = {
  createPurchaseItem,
  getPurchaseItems,
  getPurchaseItem,
  updatePurchaseItem,
  deletePurchaseItem
};
