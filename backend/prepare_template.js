const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, 'src/assets/scheffler_template.docx');
const outputPath = path.join(__dirname, 'src/assets/scheffler_template_updated.docx');

if (!fs.existsSync(templatePath)) {
    console.error('Template not found at:', templatePath);
    process.exit(1);
}

const content = fs.readFileSync(templatePath, 'binary');
const zip = new PizZip(content);
let xml = zip.file('word/document.xml').asText();

// Mapping of text to replace with tags
// I will try to find these common placeholders seen in the previous analysis
const replacements = [
    { search: 'To: - Name of the Party', replace: 'To: - {toName}' },
    { search: 'Date: - 01/01/2024', replace: 'Date: - {qtnDate}' }, // Guessing date format
    { search: 'Ref No: - QTN.KVB.STD.005', replace: 'Ref No: - {quotRef}' },
    { search: 'Sub: -', replace: 'Sub: - {subjectLine}' },
    { search: 'Rs. 0,00,000/-', replace: 'Rs. {totalAmt}/-' },
    { search: 'Rupees Zero Only', replace: '{amountWords}' },
];

console.log('Starting replacements...');

replacements.forEach(r => {
    if (xml.includes(r.search)) {
        console.log(`Found "${r.search}", replacing...`);
        xml = xml.split(r.search).join(r.replace);
    } else {
        console.log(`Could not find "${r.search}" in XML.`);
    }
});

// For the table, I need to be more surgical. 
// This is harder via raw XML but I'll try to find a hallmark of the table.

zip.file('word/document.xml', xml);
const buf = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(outputPath, buf);

console.log('Created updated template at:', outputPath);
