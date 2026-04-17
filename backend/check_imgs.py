import zipfile, re

with zipfile.ZipFile('test-q.docx') as z:
    media = [f for f in z.namelist() if 'media' in f]
    print('Media files:', media)
    rels = z.read('word/_rels/document.xml.rels').decode()
    
    for m in re.finditer(r'Id="(rIdBodyImg[^"]+)"[^>]+Target="([^"]+)"', rels):
        rid = m.group(1)
        target = m.group(2)
        fname = 'word/' + target
        exists = fname in z.namelist()
        sz = len(z.read(fname)) if exists else 0
        print(rid, '->', target, 'exists:', exists, 'size:', sz)
