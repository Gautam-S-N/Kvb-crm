const fs = require('fs');
const PizZip = require('pizzip');

const docPath = '../DPR SSD.docx';
const outPath = 'src/assets/scheffler_template.docx';

try {
  const content = fs.readFileSync(docPath, 'binary');
  const zip = new PizZip(content);
  let xml = zip.file('word/document.xml').asText();

  console.log("Surgically cleaning table 6.1...");

  // 1. Productivity Statement
  const pRegex = /<w:p(?: [^>]+)?>.*?<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xml)) !== null) {
      let pBlock = pMatch[0];
      let pText = pBlock.replace(/<[^>]+>/g, '');
      if (pText.includes('30 dishes can fulfill')) {
          const wpOpen = pBlock.match(/^<w:p(?: [^>]+)?>/)[0];
          const wpPr = pBlock.match(/<w:pPr>.*?<\/w:pPr>/);
          const properties = wpPr ? wpPr[0] : '';
          const cleanPara = `${wpOpen}${properties}<w:r><w:t>{dishesMealsStatement}</w:t></w:r></w:p>`;
          xml = xml.replace(pBlock, cleanPara);
      }
  }

  // 2. Identify the Table
  const tableRegex = /<w:tbl(?: [^>]+)?>.*?<\/w:tbl>/g;
  let tblMatch;
  while ((tblMatch = tableRegex.exec(xml)) !== null) {
      let tblBlock = tblMatch[0];
      if (tblBlock.includes('Concentrated Solar Technology Steam Cooking')) {
          console.log('Found the Pricing Table.');
          
          // Identify all rows
          const trRegex = /<w:tr(?: [^>]+)?>.*?<\/w:tr>/g;
          const rows = tblBlock.match(trRegex);
          
          if (rows) {
              // Row 0 is the heading (SL. No, Description...)
              // Row 1 is the first data row ("Concentrated Solar...")
              // Rows 2-9 are the other items
              // Row 10 is the Total
              
              const headerRow = rows[0];
              const dynamicRow = rows[1];
              const lastRow = rows[rows.length - 1]; // Total Amount row
              
              // Patch the dynamic row
              const tcSplit = dynamicRow.split(/<\/w:tc>/);
              if (tcSplit.length >= 6) {
                  function setCell(cellXml, text) {
                      const open = cellXml.match(/<w:tc(?: [^>]+)?>/)[0];
                      const pr = cellXml.match(/<w:tcPr>.*?<\/w:tcPr>/);
                      return `${open}${pr ? pr[0] : ''}<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
                  }
                  tcSplit[0] = setCell(tcSplit[0], '{SLNO}'); // Optional SL mapping
                  tcSplit[1] = setCell(tcSplit[1], '{#items}{desc}');
                  tcSplit[2] = setCell(tcSplit[2], '{qty}');
                  tcSplit[3] = setCell(tcSplit[3], '{unit}');
                  tcSplit[4] = setCell(tcSplit[4], '{rate}');
                  tcSplit[5] = setCell(tcSplit[5], '{amount}{/items}');
                  
                  const patchedDynamicRow = tcSplit.join('</w:tc>');
                  
                  // Reconstruct the table with ONLY: Header, 1 Dynamic Row, and Footer
                  const newTbl = tblBlock.replace(rows.join(''), headerRow + patchedDynamicRow + lastRow);
                  xml = xml.replace(tblBlock, newTbl);
                  console.log('Table cleaned: Reduced to 1 dynamic row loop.');
              }
          }
      }
  }

  // 3. Final Footer Tags
  xml = xml.replace(/1,87,00,000/g, '{totalAmt}');
  xml = xml.replace(/Rupees One Core Eighty-Seven Lakhs Only/g, '{amountWords}');

  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(outPath, buf);
  console.log('Properly finished template preparation.');

} catch (err) {
  console.error("Patch err:", err);
}
