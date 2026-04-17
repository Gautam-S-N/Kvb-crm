const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.quotation.updateMany({
  where: { quotationNumber: 'Q-00008' },
  data: {
    totalAmount: 500,
    subTotal: 500,
    customFields: {
      qty: 5,
      arch: 'GP Square pipe 40x40mm',
      units: 'Sqft',
      purlin: 'GP Square Pipe 40mm x 40mm',
      toName: 'Shivanand Narajji',
      gstRate: 18,
      qtnDate: '17/04/2026',
      quotRef: '',
      itemDesc: 'Supply and installation of Polycarbonate sheet covered Solar Tunnel Dryer 1080 Sq ft.',
      totalAmt: 500,
      traySize: 'Tray size 2ftx3ft – Customer Scope',
      unitPrice: 100,
      dimensions: '54ft L X 20 ft W X 8.5 ft H',
      productType: 'Rectangular type with top parabolic Shape',
      subjectLine: 'QTN.KVB.STD.005. A.080426 Solar Tunnel Dryer for 20w x 54L = 1080 Sq ft',
      centerHeight: '8.5 feet',
      freightTerms: 'Freight and insurance – To your account',
      packingTerms: 'Packing – 3% extra (Bubble sheet / corrugated sheet)',
      paymentTerms: '– 70% Advance along with PO 30% against Performa invoice after inspection at factory prior to despatch',
      deliveryTerms: 'To your account',
      structureDoor: 'GP Square Pipe Frame 25x25mm'
    }
  }
}).then(r => console.log('Updated Q-00008 to 500')).finally(() => prisma.$disconnect());
