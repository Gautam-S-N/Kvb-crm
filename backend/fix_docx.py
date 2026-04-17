from docx import Document
import re

doc = Document('D:/kvb-crm/backend/src/assets/dryer_template.docx')

changed = False
for p in doc.paragraphs:
    if 'Five' in p.text and 'Lakh' in p.text:
        original = p.text
        # We replace the text inside the Run objects so we don't lose formatting
        for run in p.runs:
            if 'Five Lakhs' in run.text:
                run.text = run.text.replace('Five Lakhs Eight Three Thousand Two Hundred Rupees Only', '{amountWords}')
                changed = True
                
        # If it spanned multiple runs, fallback to simple string replace (might drop some bolding)
        if not changed:
            p.text = p.text.replace('Five Lakhs Eight Three Thousand Two Hundred Rupees Only', '{amountWords}')
            changed = True
            
        print(f"Replaced in paragraph. Now: '{p.text}'")

if changed:
    doc.save('D:/kvb-crm/backend/src/assets/dryer_template.docx')
    print("Saved modified template!")
else:
    print("Failed to replace!")
