const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, 'src/assets/scheffler_template.docx');
const outputPath = path.join(__dirname, 'src/assets/scheffler_template.docx');

try {
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    let xml = zip.file('word/document.xml').asText();

    // 1. Replace the meals statement
    // We look for parts of the string in case it's split.
    // The dump showed "30 dishes can fulfill the Lunch and Dinner requirement for 3000 Meals ."
    // We'll use a regex that handles potential XML tags between characters
    const statementPattern = /30[\s\S]*?dishes[\s\S]*?can[\s\S]*?fulfill[\s\S]*?the[\s\S]*?Lunch[\s\S]*?and[\s\S]*?Dinner[\s\S]*?requirement[\s\S]*?for[\s\S]*?3000[\s\S]*?Meals[\s\S]*?\./g;
    
    // 2. Replace the Ref No
    // QTN.KVB.SSD . 003.A. 03 0426
    const refPattern = /QTN[\s\S]*?KVB[\s\S]*?SSD[\s\S]*?\.\s*003\.A\.[\s\S]*?03\s+0426/g;

    // 3. Table Rows 6.1
    // We already tried "Concentrated Solar Technology Steam Cooking"
    
    console.log('Final Patching...');
    
    const originalXml = xml;
    
    // We want to replace the whole match with the tag
    // For the statement, we replace the entire phrase
    xml = xml.replace(statementPattern, '{dishesMealsStatement}');
    xml = xml.replace(refPattern, '{quotRef}');
    
    // Table 6.1 Item 1 row
    if (xml.includes('Concentrated Solar Technology Steam Cooking')) {
        console.log('Found table row 6.1. Refining tags...');
        xml = xml.replace('Concentrated Solar Technology Steam Cooking', '{#items}{desc}');
        xml = xml.replace('30 Nos', '{qty} {unit}');
        xml = xml.replace('3,95,000', '{rate}');
        // Note: the total amount for row 1 was 1,18,50,000
        xml = xml.replace('1,18,50,000', '{amount}{/items}');
    }

    if (xml === originalXml) {
        console.log('No changes made. Patterns might not have matched the XML structure exactly.');
    } else {
        console.log('Changes applied successfully.');
        zip.file('word/document.xml', xml);
        const buf = zip.generate({ type: 'nodebuffer' });
        fs.writeFileSync(outputPath, buf);
    }

} catch (err) {
    console.error('Final Patch Error:', err);
}
