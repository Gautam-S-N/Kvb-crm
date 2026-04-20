const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const outPath = path.join(__dirname, 'src/assets/scheffler_template.docx');

try {
  const content = fs.readFileSync(outPath, 'binary');
  const zip = new PizZip(content);
  let xml = zip.file('word/document.xml').asText();

  console.log("Applying No-Loss Patch...");

  /**
   * Surgically replaces text within a paragraph without touching drawings/images.
   */
  function safeReplace(xmlStr, searchKey, replacementTag) {
    const pRegex = /<w:p(?: [^>]+)?>.*?<\/w:p>/g;
    let match;
    while ((match = pRegex.exec(xmlStr)) !== null) {
      let pBlock = match[0];
      let plainText = pBlock.replace(/<[^>]+>/g, '');
      
      if (plainText.includes(searchKey)) {
        console.log(`Found: "${plainText.substring(0, 30)}..."`);
        
        // If it has drawings, we MUST preserve them. 
        // We'll replace the text content of the last w:t tag or all w:t tags.
        if (pBlock.includes('<w:drawing>') || pBlock.includes('<w:object>')) {
           console.log("Paragraph contains drawings. Protecting structural nodes...");
           // We'll replace all text runs content but keep the runs themselves.
           // Actually, the safest is to find the LAST <w:t> content and empty others.
           let firstRun = true;
           pBlock = pBlock.replace(/<w:t[^>]*>.*?<\/w:t>/g, (m) => {
              if (firstRun) {
                firstRun = false;
                return m.replace(/>.*?<\/w:t>/, `>${replacementTag}</w:t>`);
              }
              return m.replace(/>.*?<\/w:t>/, `></w:t>`);
           });
        } else {
           // No drawings? We can safely simplify the paragraph structure.
           const wpOpen = pBlock.match(/^<w:p(?: [^>]+)?>/)[0];
           const wpPr = pBlock.match(/<w:pPr>.*?<\/w:pPr>/);
           const props = wpPr ? wpPr[0] : '';
           pBlock = `${wpOpen}${props}<w:r><w:t>${replacementTag}</w:t></w:r></w:p>`;
        }
        xmlStr = xmlStr.replace(match[0], pBlock);
      }
    }
    return xmlStr;
  }

  // 1. Text Replacements
  xml = safeReplace(xml, "KG Group of Companies", "{toName}");
  xml = safeReplace(xml, "QTN.KVB.SSD", "{quotRef}");
  xml = safeReplace(xml, "30 dishes can fulfill", "{dishesMealsStatement}");
  xml = safeReplace(xml, "Rupees One Core Eighty-Seven Lakhs Only", "{amountWords}");
  xml = safeReplace(xml, "44 Months", "{roiYears} Years");
  
  // 2. Pricing Table (Section 6.1)
  // We look for the unique product name row
  const tableRegex = /<w:tbl(?: [^>]+)?>.*?<\/w:tbl>/g;
  let tblMatch;
  while ((tblMatch = tableRegex.exec(xml)) !== null) {
      let tblBlock = tblMatch[0];
      if (tblBlock.includes('Concentrated Solar Technology Steam Cooking')) {
          console.log("Formatting Pricing Table...");
          const trRegex = /<w:tr(?: [^>]+)?>.*?<\/w:tr>/g;
          const rows = tblBlock.match(trRegex);
          if (rows && rows.length > 2) {
              const header = rows[0];
              const dataRow = rows[1];
              const footer = rows[rows.length - 1]; // Assume last row is "Total Amount"

              // Fix the dataRow cells
              const tcSplit = dataRow.split(/<\/w:tc>/);
              if (tcSplit.length >= 6) {
                const setCell = (c, t) => {
                    const open = c.match(/<w:tc(?: [^>]+)?>/)[0];
                    const pr = c.match(/<w:tcPr>.*?<\/w:tcPr>/);
                    return `${open}${pr ? pr[0] : ''}<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
                };
                tcSplit[1] = setCell(tcSplit[1], "{#items}{desc}");
                tcSplit[2] = setCell(tcSplit[2], "{qty}");
                tcSplit[3] = setCell(tcSplit[3], "{unit}");
                tcSplit[4] = setCell(tcSplit[4], "{rate}");
                tcSplit[5] = setCell(tcSplit[5], "{amount}{/items}");
                
                const newRow = tcSplit.join('</w:tc>');
                const newTbl = tblBlock.replace(rows.join(''), header + newRow + footer);
                xml = xml.replace(tblBlock, newTbl);
              }
          }
      }
  }

  // 3. Simple totals
  xml = xml.replace(/1,87,00,000/g, "{totalAmt}");

  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(outPath, buf);
  console.log("No-Loss Patch Success!");

} catch (err) {
  console.error("Patch error:", err);
}
