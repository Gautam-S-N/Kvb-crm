const fs = require('fs');
const PizZip = require('pizzip');

try {
  const zip = new PizZip(fs.readFileSync('../DPR SSD.docx', 'binary'));
  const xml = zip.file('word/document.xml').asText();
  fs.writeFileSync('original_document.xml', xml, 'utf8');
  console.log('original_document.xml extracted in backend');
} catch (e) {
  console.error(e);
}
