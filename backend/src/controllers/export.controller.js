const prisma = require('../utils/db');
const { Parser } = require('json2csv');

exports.exportData = async (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    let fields = [];

    switch (type) {
      case 'leads':
        data = await prisma.lead.findMany({ select: { id: true, leadNumber: true, title: true, status: true, source: true, estimateAmount: true, customer: { select: { contactName: true, phone: true } }, createdAt: true } });
        fields = ['id', 'leadNumber', 'title', 'status', 'source', 'estimateAmount', 'customer.contactName', 'customer.phone', 'createdAt'];
        break;
      case 'sales':
        data = await prisma.sale.findMany({ select: { id: true, saleNumber: true, totalAmount: true, status: true, paymentStatus: true, saleDate: true, customer: { select: { contactName: true } } } });
        fields = ['id', 'saleNumber', 'totalAmount', 'status', 'paymentStatus', 'customer.contactName', 'saleDate'];
        break;
      case 'purchases':
        data = await prisma.purchaseOrder.findMany({ select: { id: true, poNumber: true, totalAmount: true, status: true, vendor: { select: { companyName: true } }, orderDate: true } });
        fields = ['id', 'poNumber', 'vendor.companyName', 'totalAmount', 'status', 'orderDate'];
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid export type. Must be leads, sales, or purchases' });
    }

    if (data.length === 0) {
      return res.status(404).json({ success: false, message: 'No records found to export' });
    }

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment(`${type}-${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
