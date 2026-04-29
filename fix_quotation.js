const fs = require('fs');
const file = 'd:/kvb-crm/backend/src/controllers/quotation.controller.js';
let lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');

// Remove the broken/orphaned lines 1186-1194 (0-indexed: 1185-1193)
// Replace lines 1183-1214 with the correct single version
const before = lines.slice(0, 1182); // 0..1181 (lines 1..1182)
const after  = lines.slice(1214);    // line 1215 onwards (the product-summary etc.)

const replacement = [
  '      return res.send(buf);',
  '    }',
  '',
  '    // Standard quotation: fall back to html-to-docx',
  "    const html = buildStandardHTML(quotation);",
  "    const htmlToDocx = require('html-to-docx');",
  "    const bodyMatch = html.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);",
  '    let cleanHtml = bodyMatch ? bodyMatch[1] : html;',
  '    cleanHtml = cleanHtml.replace(/<img[^>]+class="letterhead-bg"[^>]*>/i, \'\');',
  '',
  '    const docxBuffer = await htmlToDocx(cleanHtml, null, {',
  '      margins: { top: 720, bottom: 720, left: 720, right: 720 }',
  '    });',
  '',
  "    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');",
  '    res.setHeader(\'Content-Disposition\', `attachment; filename=Quotation-${quotation.quotationNumber}.docx`);',
  '    res.send(docxBuffer);',
  '  } catch (error) {',
  "    console.error('generateDOCX error:', error);",
  '    res.status(500).json({ success: false, message: error.message });',
  '  }',
  '};',
];

const fixed = [...before, ...replacement, '', ...after];
fs.writeFileSync(file, fixed.join('\n'), 'utf8');
console.log('Done. Total lines now:', fixed.length);
