const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, 'src/assets/scheffler_template.docx');
const outputPath = path.join(__dirname, 'src/assets/scheffler_template.docx');

try {
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    let xml = zip.file('word/document.xml').asText();

    // Mapping - ONLY LONG UNIQUE STRINGS
    const replacements = [
        { search: 'KG Group of Companies, Coimbatore', replace: '{toName}' },
        { search: 'Rupees One Core Eighty-Seven Lakhs Only', replace: '{amountWords}' },
        { search: '1,87,00,000', replace: '{totalAmt}' },
        { search: 'Concentrated Solar Technology Steam Cooking', replace: '{#items}{desc}' }
    ];

    replacements.forEach(r => {
        if (xml.includes(r.search)) {
            xml = xml.split(r.search).join(r.replace);
        }
    });

    zip.file('word/document.xml', xml);
    const buf = zip.generate({ type: 'nodebuffer' });
    fs.writeFileSync(outputPath, buf);
    console.log('Safe patch complete.');
} catch (e) {
    console.error(e);
}
