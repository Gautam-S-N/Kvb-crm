import zipfile
import re

with zipfile.ZipFile('D:/kvb-crm/backend/src/assets/dryer_template.docx', 'r') as z:
    doc = z.read('word/document.xml').decode('utf-8')

# Find all blip rId references (inline images in body)
blips = re.findall(r'r:embed="(rId\d+)"', doc)
print('Inline image rIds in body:', blips)

# Find context of rId10 (image2.jpeg - which is now our FOOTER image)
idx = doc.find('rId10')
if idx >= 0:
    print('\nContext of rId10 (image2.jpeg / footer image in body?):')
    print(doc[max(0,idx-300):idx+300])
