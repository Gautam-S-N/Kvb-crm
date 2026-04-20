const fs = require('fs');
const PizZip = require('pizzip');

const outPath = 'src/assets/scheffler_template.docx';

try {
  const content = fs.readFileSync(outPath, 'binary');
  const zip = new PizZip(content);
  let xmlContainer = [zip.file('word/document.xml').asText()];

  Array.prototype.replaceParagraphWithText = function(regexStr, newText) {
    let rawXML = this[0];
    const pRegex = /<w:p(?: [^>]+)?>.*?<\/w:p>/g;
    let match;
    let changed = false;
    while ((match = pRegex.exec(rawXML)) !== null) {
      let pBlock = match[0];
      let textContent = pBlock.replace(/<[^>]+>/g, '');
      const r = new RegExp(regexStr);
      if (r.test(textContent)) {
        console.log(`Found matching paragraph: "${textContent}"`);
        const wpOpen = pBlock.match(/^<w:p(?: [^>]+)?>/)[0];
        const wpPr = pBlock.match(/<w:pPr>.*?<\/w:pPr>/);
        const properties = wpPr ? wpPr[0] : '';
        const cleanPara = `${wpOpen}${properties}<w:r><w:t>${newText}</w:t></w:r></w:p>`;
        rawXML = rawXML.replace(pBlock, cleanPara);
        changed = true;
      }
    }
    if (changed) this[0] = rawXML;
  };

  // 1. Total Amount 
  xmlContainer.replaceParagraphWithText('1,87,00,000', '{totalAmt}');
  
  // 2. Amount Words
  xmlContainer.replaceParagraphWithText('Rupees One Core Eighty-Seven Lakhs Only', '{amountWords}');
  
  // 3. ROI Years
  xmlContainer.replaceParagraphWithText('44 Months', '{roiYears} Years');
  
  zip.file('word/document.xml', xmlContainer[0]);
  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(outPath, buf);
  console.log('Safe DOM patching Pass 2 complete.');

} catch (err) {
  console.error("DOM patch err:", err);
}
