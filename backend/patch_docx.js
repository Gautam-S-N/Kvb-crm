const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, 'src/assets/scheffler_template.docx');
const outputPath = path.join(__dirname, 'src/assets/scheffler_template.docx'); // Overwrite original as requested

try {
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    let xml = zip.file('word/document.xml').asText();

    // Mapping of hardcoded text found in the dump to the required tags
    const replacements = [
        // Header / Customer Info
        { search: 'KG Group of Companies, Coimbatore', replace: '{toName}' },
        { search: 'Siddharodmath , Siddhganga Mathas', replace: '{toName}' },
        { search: 'Siddharodmath , Siddhagangamath', replace: '{toName}' },
        { search: '03 0426', replace: '{qtnDate}' },
        { search: 'SSD . 003.A.', replace: 'SSD . {quotRef}' },
        
        // ROI Section
        { search: '6', replace: '{cylinderConsumption}' },
        { search: '1800', replace: '{cylinderPrice}' },
        { search: '44 Months', replace: '{roiYears} Years' },
        
        // Totals
        { search: '1,87,00,000', replace: '{totalAmt}' },
        { search: 'Rupees One Core Eighty-Seven Lakhs Only', replace: '{amountWords}' }
    ];

    console.log('Patching XML content...');

    replacements.forEach(r => {
        // Use a global regex to replace all instances
        // We use a simple split/join to avoid regex escaping issues with numbers/dots
        const parts = xml.split(r.search);
        if (parts.length > 1) {
            console.log(`Successfully replaced "${r.search}" with "${r.replace}" (${parts.length - 1} times)`);
            xml = parts.join(r.replace);
        } else {
            console.log(`Warning: Could not find exact string "${r.search}"`);
        }
    });

    // Special handling for the table row 6.1
    // We look for a unique piece of the first item and try to wrap the row tags
    // This is risky in raw XML but let's try to find a hallmark.
    if (xml.includes('Concentrated Solar Technology Steam Cooking')) {
        console.log('Found table row 6.1. Attempting to inject loop tags...');
        // Note: This is an approximation. In a real doc, <w:tr> tags are needed.
        // We'll look for the item amount "1,18,50,000" which is unique to that row.
        xml = xml.replace('Concentrated Solar Technology Steam Cooking', '{#items}{desc}');
        xml = xml.replace('30 Nos', '{qty} {unit}');
        xml = xml.replace('3,95,000', '{rate}');
        xml = xml.replace('1,18,50,000', '{amount}{/items}');
    }

    zip.file('word/document.xml', xml);
    const buf = zip.generate({ type: 'nodebuffer' });
    fs.writeFileSync(outputPath, buf);
    console.log('Automation complete. File d:\\kvb-crm\\backend\\src\\assets\\scheffler_template.docx updated.');

} catch (err) {
    console.error('Error during automation:', err);
}
