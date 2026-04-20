const fs = require('fs');
const PizZip = require('pizzip');

const outPath = 'src/assets/scheffler_template.docx';

try {
  const content = fs.readFileSync(outPath, 'binary');
  const zip = new PizZip(content);
  let xml = zip.file('word/document.xml').asText();

  console.log("Applying Bulletproof Tag Injection...");

  /**
   * Replaces a whole paragraph containing a search string with a clean tag paragraph
   * This is the ONLY way to prevent Word corruption from split XML runs.
   */
  function rebuildParagraph(xmlStr, searchKey, tag) {
    const pRegex = /<w:p(?: [^>]+)?>.*?<\/w:p>/g;
    let match;
    while ((match = pRegex.exec(xmlStr)) !== null) {
      let pBlock = match[0];
      let plainText = pBlock.replace(/<[^>]+>/g, '');
      if (plainText.includes(searchKey)) {
        console.log(`Matched Paragraph: "${plainText.substring(0, 50)}..." -> Replacing with: ${tag}`);
        // Extract properties (alignment, etc) if available
        const wpOpen = pBlock.match(/^<w:p(?: [^>]+)?>/)[0];
        const wpPr = pBlock.match(/<w:pPr>.*?<\/w:pPr>/);
        const props = wpPr ? wpPr[0] : '';
        // Create a perfectly clean XML structure for the tag
        const newP = `${wpOpen}${props}<w:r><w:t>${tag}</w:t></w:r></w:p>`;
        xmlStr = xmlStr.replace(pBlock, newP);
      }
    }
    return xmlStr;
  }

  // 1. Rebuild standard text fields
  xml = rebuildParagraph(xml, "KG Group of Companies", "{toName}");
  xml = rebuildParagraph(xml, "QTN.KVB.SSD", "{quotRef}");
  xml = rebuildParagraph(xml, "30 dishes can fulfill", "{dishesMealsStatement}");
  xml = rebuildParagraph(xml, "Rupees One Core Eighty-Seven Lakhs Only", "{amountWords}");
  xml = rebuildParagraph(xml, "44 Months", "{roiYears} Years");

  // 2. Surgical Table Cleaning (Section 6.1)
  const tblRegex = /<w:tbl(?: [^>]+)?>.*?<\/w:tbl>/g;
  let tblMatch;
  while ((tblMatch = tblRegex.exec(xml)) !== null) {
    let tblBlock = tblMatch[0];
    if (tblBlock.includes('Concentrated Solar Technology Steam Cooking')) {
      console.log('Found Pricing Table. Trimming to 1 dynamic row...');
      
      const trRegex = /<w:tr(?: [^>]+)?>.*?<\/w:tr>/g;
      const rows = tblBlock.match(trRegex);
      
      if (rows && rows.length > 2) {
        const headerRow = rows[0];
        const dataRow = rows[1]; // The "Concentrated Solar" row
        const lastRow = rows[rows.length - 1]; // Total Amount row
        
        // Clean the Cells in the data row
        const tcSplit = dataRow.split(/<\/w:tc>/);
        if (tcSplit.length >= 6) {
          const setCell = (cell, txt) => {
            const open = cell.match(/<w:tc(?: [^>]+)?>/)[0];
            const pr = cell.match(/<w:tcPr>.*?<\/w:tcPr>/);
            return `${open}${pr ? pr[0] : ''}<w:p><w:r><w:t>${txt}</w:t></w:r></w:p>`;
          };
          
          tcSplit[0] = setCell(tcSplit[0], "1");
          tcSplit[1] = setCell(tcSplit[1], "{#items}{desc}");
          tcSplit[2] = setCell(tcSplit[2], "{qty}");
          tcSplit[3] = setCell(tcSplit[3], "{unit}");
          tcSplit[4] = setCell(tcSplit[4], "{rate}");
          tcSplit[5] = setCell(tcSplit[5], "{amount}{/items}");
          
          const newDynamicRow = tcSplit.join('</w:tc>');
          const newTbl = tblBlock.replace(rows.join(''), headerRow + newDynamicRow + lastRow);
          xml = xml.replace(tblBlock, newTbl);
        }
      }
    }
  }

  // 3. Final global replacements for simple values (safer since they are likely single runs)
  xml = xml.replace(/1,87,00,000/g, '{totalAmt}');

  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(outPath, buf);
  console.log('SUCCESS: Document is now fully tagged and healthy.');

} catch (err) {
  console.error("Critical Injection Error:", err);
}
