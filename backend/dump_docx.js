const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, 'src/assets/scheffler_template.docx');

try {
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const xml = zip.file('word/document.xml').asText();
    
    // Simple text extraction from XML
    const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    fs.writeFileSync('docx_dump.txt', text);
    console.log('Text dumped to docx_dump.txt');
} catch (e) {
    console.error(e);
}
