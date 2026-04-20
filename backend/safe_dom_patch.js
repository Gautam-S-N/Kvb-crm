const fs = require('fs');
const PizZip = require('pizzip');

const docPath = '../DPR SSD.docx';
const outPath = 'src/assets/scheffler_template.docx';

try {
  const content = fs.readFileSync(docPath, 'binary');
  const zip = new PizZip(content);
  let xml = zip.file('word/document.xml').asText();

  console.log("Analyzing XML...");

  // We find the paragraph <w:p> ... </w:p> that contains the text
  // We cannot use simple replace because the text is broken up into multiple <w:t> tags.
  // Instead, we use regex to replace the inner content of a <w:t> tags when we clearly identify the parent <w:p>.

  // To do a perfectly safe replace, docxtemplater recommends just replacing the WHOLE <w:p> node string with a cleaner one, 
  // or replacing the <w:t> spans inside it.

  Array.prototype.replaceParagraphWithText = function(regexStr, newText) {
    let rawXML = this[0];
    
    // Find all paragraphs
    const pRegex = /<w:p(?: [^>]+)?>.*?<\/w:p>/g;
    let match;
    while ((match = pRegex.exec(rawXML)) !== null) {
      let pBlock = match[0];
      // Strip XML tags to see just the plain text this paragraph represents
      let textContent = pBlock.replace(/<[^>]+>/g, '');
      
      const r = new RegExp(regexStr);
      if (r.test(textContent)) {
        console.log(`Found matching paragraph: "${textContent}"`);
        
        // We will replace the entire paragraph with a new clean one.
        // Copy the opening <w:p ...> and <w:pPr> (properties like justification/bold).
        const wpOpen = pBlock.match(/^<w:p(?: [^>]+)?>/)[0];
        const wpPr = pBlock.match(/<w:pPr>.*?<\/w:pPr>/);
        const properties = wpPr ? wpPr[0] : '';
        
        // Build the clean string
        const cleanPara = `${wpOpen}${properties}<w:r><w:t>${newText}</w:t></w:r></w:p>`;
        
        rawXML = rawXML.replace(pBlock, cleanPara);
      }
    }
    this[0] = rawXML;
  };

  let xmlContainer = [xml];

  // 1. Productivity Statement
  xmlContainer.replaceParagraphWithText('30 dishes can fulfill', '{dishesMealsStatement}');
  
  // 2. Ref No (e.g. QTN.KVB.SSD . 003.A. 03 0426)
  xmlContainer.replaceParagraphWithText('QTN\\.KVB\\.SSD', '{quotRef}');
  
  // 3. Customer Name in header (KG Group of Companies, Coimbatore)
  xmlContainer.replaceParagraphWithText('KG Group of Companies, Coimbatore', '{toName}');
  
  // 4. Date
  xmlContainer.replaceParagraphWithText('03 0426', '{qtnDate}'); // Very unique string for the date in that report

  // Table rows are trickier because we need to replace cells <w:tc>, not entire paragraphs.
  // Let's find the table row containing "Concentrated Solar Technology Steam Cooking"
  const trRegex = /<w:tr(?: [^>]+)?>.*?<\/w:tr>/g;
  let trMatch;
  while ((trMatch = trRegex.exec(xmlContainer[0])) !== null) {
      let trBlock = trMatch[0];
      let trText = trBlock.replace(/<[^>]+>/g, '');
      if (trText.includes('Concentrated Solar Technology Steam Cooking') && trText.includes('1,18,50,000')) {
          console.log('Found the pricing table row.');
          
          // Split into cells <w:tc>
          const tcSplit = trBlock.split(/<\/w:tc>/);
          // tcSplit has the cells.
          // Cell 0: Index / Serial no
          // Cell 1: Description
          // Cell 2: Qty / UOM
          // Cell 3: Unit Rate
          // Cell 4: Total
          
          if(tcSplit.length >= 6) {
             // We can safely inject docxtemplater tags inside the text runs of these cells.
             function setCellText(cellXML, newText) {
                 const tcOpenMatch = cellXML.match(/<w:tc(?: [^>]+)?>/);
                 if(!tcOpenMatch) return cellXML;
                 const tcOpen = tcOpenMatch[0];
                 const tcPr = cellXML.match(/<w:tcPr>.*?<\/w:tcPr>/);
                 const props = tcPr ? tcPr[0] : '';
                 return `${tcOpen}${props}<w:p><w:r><w:t>${newText}</w:t></w:r></w:p>`;
             }
             
             tcSplit[1] = setCellText(tcSplit[1], '{#items}{desc}');
             tcSplit[2] = setCellText(tcSplit[2], '{qty} {unit}');
             tcSplit[3] = setCellText(tcSplit[3], '{rate}');
             tcSplit[4] = setCellText(tcSplit[4], '{amount}{/items}');
             
             const newTr = tcSplit.join('</w:tc>');
             xmlContainer[0] = xmlContainer[0].replace(trBlock, newTr);
             console.log('Replaced table row safely.');
          }
      }
  }

  zip.file('word/document.xml', xmlContainer[0]);
  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(outPath, buf);
  console.log('Safe DOM patching complete.');

} catch (err) {
  console.error("DOM patch err:", err);
}
