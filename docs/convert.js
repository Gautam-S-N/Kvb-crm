const fs = require('fs').promises;
const { marked } = require('marked');
const HTMLtoDOCX = require('html-to-docx');

async function convert(fileIn, fileOut) {
  try {
    const markdown = await fs.readFile(fileIn, 'utf8');
    const html = marked.parse(markdown);
    
    const docxBuffer = await HTMLtoDOCX(html, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });
    
    await fs.writeFile(fileOut, docxBuffer);
    console.log(`Successfully created ${fileOut}`);
  } catch (error) {
    console.error(`Error converting ${fileIn}:`, error);
  }
}

async function run() {
  await convert('1_Features_Overview.md', '1_Features_Overview.docx');
  await convert('2_User_Manual.md', '2_User_Manual.docx');
  await convert('3_Technical_Architecture.md', '3_Technical_Architecture.docx');
}

run();
