const fs = require('fs');
const PizZip = require('pizzip');

const content = fs.readFileSync('DPR SSD.docx', 'binary');
const zip = new PizZip(content);
const xml = zip.file('word/document.xml').asText();

// extract all w:t tags to see the text
const regex = /<w:t(?:[^>]*)>([^<]*)<\/w:t>/g;
let match;
let fullText = '';
while ((match = regex.exec(xml)) !== null) {
  fullText += match[1];
}

fs.writeFileSync('docx_text.txt', fullText);
console.log('Saved to docx_text.txt');
