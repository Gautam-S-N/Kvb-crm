from docx import Document
import json

doc = Document('D:/kvb-crm/backend/src/assets/dryer_template.docx')

cells_text = []
for t in doc.tables:
    for row in t.rows:
        row_text = []
        for cell in row.cells:
            row_text.append(cell.text.strip())
        cells_text.append(row_text)

print(json.dumps(cells_text, indent=2))
