const prisma = require('./src/utils/db');
const fs = require('fs');
const htmlToDocx = require('html-to-docx');
const { generateDOCX } = require('./src/controllers/quotation.controller.js');

(async () => {
  try {
    const q = await prisma.quotation.findFirst({ where: { quotationNumber: 'Q-00006' }});
    if (!q) { console.log('not found'); return; }

    const req = { params: { id: q.id } };
    const res = {
      setHeader: (k, v) => console.log('header', k, v),
      status: (c) => ({ json: (o) => console.log('err', c, o) }),
      send: (buf) => {
        fs.writeFileSync('D:\\kvb-crm\\backend\\test-q.docx', buf);
        console.log('Saved test-q.docx, bytes:', buf.length);
      }
    };

    await generateDOCX(req, res);
  } catch (err) {
    console.error('Crash:', err);
  }
})();
