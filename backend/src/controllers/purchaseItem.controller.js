const { eq, and, or, like, asc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// Create a new purchase item
const createPurchaseItem = async (req, res) => {
  try {
    const { name, hsnCode, description, unit, rate, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const id = randomUUID();
    const newItem = {
      id,
      name,
      hsnCode: hsnCode || null,
      description: description || null,
      unit: unit || 'Nos',
      rate: rate ? parseFloat(rate).toFixed(2) : '0.00',
      isActive: isActive !== undefined ? isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(schema.purchaseItems).values(newItem);

    res.status(201).json({
      success: true,
      message: 'Purchase item created successfully',
      data: newItem
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
    
    const conditions = [];
    
    if (activeOnly === 'true') {
      conditions.push(eq(schema.purchaseItems.isActive, true));
    }
    
    if (search) {
      conditions.push(
        or(
          like(schema.purchaseItems.name, `%${search}%`),
          like(schema.purchaseItems.hsnCode, `%${search}%`)
        )
      );
    }

    const items = await db.select()
      .from(schema.purchaseItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(schema.purchaseItems.name));

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
    
    const itemsList = await db.select()
      .from(schema.purchaseItems)
      .where(eq(schema.purchaseItems.id, id))
      .limit(1);

    if (itemsList.length === 0) {
      return res.status(404).json({ error: 'Purchase item not found' });
    }

    res.status(200).json({
      success: true,
      data: itemsList[0]
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

    const existingList = await db.select()
      .from(schema.purchaseItems)
      .where(eq(schema.purchaseItems.id, id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ error: 'Purchase item not found' });
    }

    const updateData = {
      name: name !== undefined ? name : existingList[0].name,
      hsnCode: hsnCode !== undefined ? hsnCode : existingList[0].hsnCode,
      description: description !== undefined ? description : existingList[0].description,
      unit: unit !== undefined ? unit : existingList[0].unit,
      rate: rate !== undefined ? parseFloat(rate).toFixed(2) : existingList[0].rate,
      isActive: isActive !== undefined ? isActive : existingList[0].isActive,
      updatedAt: new Date()
    };

    await db.update(schema.purchaseItems)
      .set(updateData)
      .where(eq(schema.purchaseItems.id, id));

    res.status(200).json({
      success: true,
      message: 'Purchase item updated successfully',
      data: { ...existingList[0], ...updateData }
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

    const existingList = await db.select()
      .from(schema.purchaseItems)
      .where(eq(schema.purchaseItems.id, id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ error: 'Purchase item not found' });
    }

    await db.delete(schema.purchaseItems)
      .where(eq(schema.purchaseItems.id, id));

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
