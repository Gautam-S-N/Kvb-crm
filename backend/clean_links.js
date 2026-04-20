const fs = require('fs');
const PizZip = require('pizzip');

const outPath = 'src/assets/scheffler_template.docx';

try {
  const content = fs.readFileSync(outPath, 'binary');
  const zip = new PizZip(content);
  let xml = zip.file('word/document.xml').asText();

  console.log("Scrubbing broken Excel links...");

  // Regex to find and remove the entire LINK field block
  // Word fields usually look like <w:fldSimple w:instr=" LINK ... "> or complex fldChar sequences.
  // The most common way they appear in raw text is inside a w:instr tag.
  
  // We will look for the LINK Excel.Sheet pattern and remove the instructions.
  const linkPattern = /<w:fldSimple[^>]+?LINK Excel\.Sheet\.12[^>]+?>[\s\S]*?<\/w:fldSimple>/g;
  const instrPattern = /<w:instrText[^>]*?>\s*LINK Excel\.Sheet\.12[\s\S]*?<\/w:instrText>/g;

  let originalXml = xml;
  xml = xml.replace(linkPattern, '');
  xml = xml.replace(instrPattern, '');

  if (xml !== originalXml) {
    console.log("Successfully removed Excel link codes.");
  } else {
    console.log("Pattern match failed, trying a broader search for 'LINK Excel'...");
    // Broader search for the field character blocks
    xml = xml.replace(/LINK Excel\.Sheet\.12.*?\d\s+\\h/g, '');
  }

  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(outPath, buf);
  console.log('Cleanup complete.');

} catch (err) {
  console.error("Cleanup err:", err);
}
