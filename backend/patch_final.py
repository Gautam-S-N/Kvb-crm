"""
Definitive fix: Proper approach that preserves all rels from base doc.
Root cause: regex [^/]*/ was failing on rels containing Target paths with slashes.
Fix: Parse and reconstruct rels properly without regex on content.
"""
import zipfile, shutil, re
from xml.etree import ElementTree as ET

BASE       = 'D:/kvb-crm/New_Header&Footer1.docx'
ORIG_DRYER = 'D:/kvb-crm/Dryer format for CRM.docx'
DRYER_TPL  = 'D:/kvb-crm/backend/src/assets/dryer_template.docx'
OUT        = 'D:/kvb-crm/backend/src/assets/dryer_template.docx'
TEMP       = OUT + '.tmp'

NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

def read_zip(path):
    with zipfile.ZipFile(path, 'r') as z:
        return {n: z.read(n) for n in z.namelist()}

base_files   = read_zip(BASE)
dryer_files  = read_zip(DRYER_TPL)
orig_files   = read_zip(ORIG_DRYER)

# ── 1. Extract the dryer body content ─────────────────────────────────────────
dryer_doc = dryer_files['word/document.xml'].decode('utf-8')

body_match = re.search(r'<w:body>(.*?)(<w:sectPr[\s>])', dryer_doc, re.DOTALL)
dryer_body = body_match.group(1)

# Strip yellow highlights and shading
dryer_body = re.sub(r'<w:highlight[^/]*/>', '', dryer_body)
dryer_body = re.sub(r'<w:shd[^/]*/>', '', dryer_body)

# Remap body image rIds to new non-conflicting IDs
dryer_body = dryer_body.replace('r:embed="rId9"',  'r:embed="rIdBodyImg1"')
dryer_body = dryer_body.replace('r:embed="rId10"', 'r:embed="rIdBodyImg2"')

# Remap dryer hyperlink rIds
dryer_rels_raw = dryer_files['word/_rels/document.xml.rels'].decode('utf-8')
hl_map = {}
for m in re.finditer(r'Id="(rId\d+)"[^>]+hyperlink[^>]+Target="([^"]+)"', dryer_rels_raw):
    old_id, target = m.group(1), m.group(2)
    new_id = f'rIdDryHL_{old_id}'
    hl_map[old_id] = (new_id, target)
    dryer_body = dryer_body.replace(f'r:id="{old_id}"', f'r:id="{new_id}"')

# ── 2. Build new document.xml: dryer namespace header + dryer body + base sectPr ──
dryer_open = re.match(r'(.*?)<w:body>', dryer_doc, re.DOTALL).group(0)

base_doc = base_files['word/document.xml'].decode('utf-8')
sect_match = re.search(r'(<w:sectPr[\s>].*?</w:sectPr>)', base_doc, re.DOTALL)
base_sectPr = sect_match.group(1)

new_doc = dryer_open + dryer_body + base_sectPr + '</w:body></w:document>'

# ── 3. Build new document.xml.rels ────────────────────────────────────────────
# Parse ALL rels from base using ElementTree (not regex)
base_rels_xml = base_files['word/_rels/document.xml.rels']
root = ET.fromstring(base_rels_xml)
all_rel_attrs = []
for rel in root:
    all_rel_attrs.append(dict(rel.attrib))

# Add body image rels
all_rel_attrs.append({
    'Id': 'rIdBodyImg1',
    'Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
    'Target': 'media/body_img1.jpg'
})
all_rel_attrs.append({
    'Id': 'rIdBodyImg2',
    'Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
    'Target': 'media/body_img2.jpeg'
})

# Add hyperlink rels
for old_id, (new_id, target) in hl_map.items():
    all_rel_attrs.append({
        'Id': new_id,
        'Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
        'Target': target,
        'TargetMode': 'External'
    })

# Serialize
def attr_str(d):
    parts = [f'{k}="{v}"' for k, v in d.items()]
    return ' '.join(parts)

rel_entries = [f'<Relationship {attr_str(a)}/>' for a in all_rel_attrs]
new_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
            f'<Relationships xmlns="{NS}">'
            + ''.join(rel_entries)
            + '</Relationships>')

# ── 4. Content-Types ──────────────────────────────────────────────────────────
new_ct = base_files['[Content_Types].xml'].decode('utf-8')
for ext, ct in [('jpg', 'image/jpeg'), ('jpeg', 'image/jpeg')]:
    if f'Extension="{ext}"' not in new_ct:
        new_ct = new_ct.replace('</Types>', f'<Default Extension="{ext}" ContentType="{ct}"/></Types>')

# ── 5. Assemble zip ───────────────────────────────────────────────────────────
modifications = {
    'word/document.xml':            new_doc.encode('utf-8'),
    'word/_rels/document.xml.rels': new_rels.encode('utf-8'),
    '[Content_Types].xml':          new_ct.encode('utf-8'),
    # Use dryer styles for proper paragraph/table formatting
    'word/styles.xml':              dryer_files['word/styles.xml'],
    # Body images mapped to new names
    'word/media/body_img1.jpg':     orig_files.get('word/media/image1.jpg', b''),
    'word/media/body_img2.jpeg':    orig_files.get('word/media/image2.jpeg', b''),
}
# Copy other dryer media (just in case)
for n, d in orig_files.items():
    if n.startswith('word/media/') and n not in ('word/media/image1.jpg', 'word/media/image2.jpeg'):
        new_name = n.replace('word/media/', 'word/media/dryer_')
        modifications[new_name] = d

with zipfile.ZipFile(TEMP, 'w', zipfile.ZIP_DEFLATED) as zout:
    for name, data in base_files.items():
        if name not in modifications:
            zout.writestr(name, data)
    for name, data in modifications.items():
        if data:
            zout.writestr(name, data)

shutil.move(TEMP, OUT)
print('Done:', OUT)

# Verify
with zipfile.ZipFile(OUT) as z:
    rels_check = z.read('word/_rels/document.xml.rels').decode()
    has_h1 = 'header1.xml' in rels_check
    has_f1 = 'footer1.xml' in rels_check
    has_bi = 'rIdBodyImg1' in rels_check
    print(f'  header1 in rels: {has_h1}')
    print(f'  footer1 in rels: {has_f1}')
    print(f'  body images in rels: {has_bi}')
    print(f'  media files: {[f for f in z.namelist() if "media" in f]}')
