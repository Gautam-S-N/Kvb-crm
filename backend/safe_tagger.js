const fs = require('fs');
const PizZip = require('pizzip');

const targetPath = 'src/assets/scheffler_template.docx';

try {
  const content = fs.readFileSync(targetPath, 'binary');
  const zip = new PizZip(content);
  let xml = zip.file('word/document.xml').asText();

  console.log("Applying Ultra-Safe Tag Injection...");

  /**
   * INJECTS TAGS ONLY INTO TEXT RUNS.
   */
  function injectTag(xmlStr, searchKey, tag) {
    const tRegex = new RegExp(`(<w:t[^>]*>)[^<]*?${searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*?(<\/w:t>)`);
    if (xmlStr.match(tRegex)) {
        console.log(`Matched: ${searchKey}`);
        return xmlStr.replace(tRegex, `$1${tag}$2`);
    }
    return xmlStr;
  }

  // 1. Standard Tags
  xml = injectTag(xml, "KG Group of Companies", "{toName}");
  xml = injectTag(xml, "QTN.KVB.SSD.003.A", "{quotRef}");
  xml = injectTag(xml, "30 dishes can fulfill", "{dishesMealsStatement}");
  xml = injectTag(xml, "1,87,00,000", "{totalAmt}");
  xml = injectTag(xml, "Rupees One Core Eighty-Seven Lakhs Only", "{amountWords}");

  // 2. Pricing Table (Section 6.1)
  // We carefully find the table containing 'Concentrated Solar'
  const startMarker = 'Concentrated Solar Technology Steam Cooking';
  const endMarker = 'Transportation etc';

  // We find the index of the start and end rows.
  // Instead of complex parsing, we find the <w:tr> that contains the start
  // and the <w:tr> that contains the end.
  const trs = xml.match(/<w:tr(?: [^>]+)?>.*?<\/w:tr>/g);
  if (trs) {
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < trs.length; i++) {
        if (trs[i].includes(startMarker)) startIdx = i;
        if (trs[i].includes(endMarker)) endIdx = i;
    }

    if (startIdx !== -1 && endIdx !== -1) {
        console.log(`Table rows found at ${startIdx} to ${endIdx}. Trimming...`);
        let loopRow = trs[startIdx];
        // Apply tags to the loop row
        loopRow = loopRow.replace(/(<w:t[^>]*>).*?Concentrated Solar.*?<\/w:t>/, `$1{#items}{desc}</w:t>`);
        loopRow = loopRow.replace(/(<w:t[^>]*>)30(<\/w:t>)/, `$1{qty}$2`);
        loopRow = loopRow.replace(/(<w:t[^>]*>)Nos(<\/w:t>)/, `$1{unit}$2`);
        loopRow = loopRow.replace(/(<w:t[^>]*>)3,95,000(<\/w:t>)/, `$1{rate}$2`);
        loopRow = loopRow.replace(/(<w:t[^>]*>)1,18,50,000(<\/w:t>)/, `$1{amount}{/items}$2`);

        // Replace the entire sequence of rows from start to end with JUST the loop row.
        const rowBlock = trs.slice(startIdx, endIdx + 1).join('');
        xml = xml.replace(rowBlock, loopRow);
    }
  }

  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(targetPath, buf);
  console.log("Safe Tagging Success!");

} catch (err) {
  console.error("Critical error:", err);
}
