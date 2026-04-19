from docx import Document
import re

doc = Document('D:/kvb-crm/backend/src/assets/dryer_template.docx')

changed = False
for p in doc.paragraphs:
    if 'Five' in p.text and 'Lakh' in p.text:
        original = p.text
        # We replace the text inside the Run objects so we don't lose formatting
        for target in ['Five Lakh Eighty Three Thousand Two Hundred Rupees Only', 
                       'Five Lakhs Eight Three Thousand Two Hundred Rupees Only',
                       'Five Lakh Eighty Three Thousand Two Hundred']:
            if target in p.text:
                p.text = p.text.replace(target, '{amountWords}')
                changed = True
                break
            
        print(f"Replaced in paragraph. Now: '{p.text}'")

if changed:
    doc.save('D:/kvb-crm/backend/src/assets/dryer_template.docx')
    print("Saved modified template!")
else:
    print("Failed to replace!")
