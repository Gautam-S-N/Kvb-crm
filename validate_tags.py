import re, docx

def collect_tags(filepath):
    doc = docx.Document(filepath)
    text = ''
    for para in doc.paragraphs:
        text += para.text + '\n'
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    text += para.text + '\n'
    tags = re.findall(r'\{[#/]?(\w+)\}', text)
    return set(tags)

tags = collect_tags('backend/src/assets/cooker_template.docx')
print("Tags found:", sorted(tags))
