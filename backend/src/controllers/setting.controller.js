const prisma = require('../utils/db');

exports.getSettings = async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description }
    });

    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
