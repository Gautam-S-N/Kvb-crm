const { eq } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

exports.getSettings = async (req, res) => {
  try {
    const settingsList = await db.select().from(schema.settings);
    res.json({ success: true, data: settingsList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const existing = await db.select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .limit(1);

    let setting;
    if (existing.length > 0) {
      await db.update(schema.settings)
        .set({ value, description, updatedAt: new Date() })
        .where(eq(schema.settings.key, key));
        
      setting = { 
        ...existing[0], 
        value, 
        description, 
        updatedAt: new Date() 
      };
    } else {
      const id = randomUUID();
      const newSetting = {
        id,
        key,
        value,
        description: description || null,
        category: 'GENERAL',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(schema.settings).values(newSetting);
      setting = newSetting;
    }

    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
