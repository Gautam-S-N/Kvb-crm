import zipfile, re

with zipfile.ZipFile('test-q.docx') as z:
    doc = z.read('word/document.xml').decode('utf-8')
    rels = z.read('word/_rels/document.xml.rels').decode('utf-8')

# 1. Find all image embed rIds in the body
blips = re.findall(r'r:embed="([^"]+)"', doc)
print('Image rIds in body:', list(set(blips)))

# 2. Check which of those rIds are actually in rels
for bid in set(blips):
    if bid in rels:
        # Find the target
        m = re.search(rf'Id="{re.escape(bid)}"[^>]+Target="([^"]+)"', rels)
        print(f'  {bid} -> {m.group(1) if m else "NOT FOUND"}')
    else:
        print(f'  {bid} -> MISSING FROM RELS')

# 3. Count explicit page breaks to estimate pages
page_breaks = doc.count('w:type="page"')
print('\nExplicit page breaks:', page_breaks)

# 4. Check if there are extra paragraphs at end from the base doc
# Find last 2000 chars of body before sectPr
body_end_idx = doc.rfind('<w:sectPr')
print('\nLast 500 chars before sectPr:')
print(doc[max(0, body_end_idx-500):body_end_idx])
