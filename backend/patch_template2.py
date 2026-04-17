"""
Clean rebuild of dryer_template.docx:
- Take dryer_template.docx body (all text placeholders already set)
- Restore original body images (image1.jpg, image2.jpeg) from Dryer format for CRM.docx
- Add NEW header/footer images with NON-COLLIDING names: hdr1.png, hdr2.jpeg, hdr3.png
- Update header1.xml.rels and footer1.xml.rels to reference hdr1.png / hdr2.jpeg
- Update sectPr to ONLY use our rIdHdr1/rIdFtr1 references
- Remove duplicate/conflicting header refs from python-docx (rId14/15/16/17 in rels point to headers but sectPr should only use ours)
"""

import zipfile
import shutil
import re

SRC_NEW_HF = 'D:/kvb-crm/New_Header&Footer1.docx'
SRC_DRYER_ORIG = 'D:/kvb-crm/Dryer format for CRM.docx'
SRC_TEMPLATE = 'D:/kvb-crm/backend/src/assets/dryer_template.docx'
TEMP = SRC_TEMPLATE + '.new'

# Read original dryer images (correct body images)
with zipfile.ZipFile(SRC_DRYER_ORIG, 'r') as z:
    orig_img1 = z.read('word/media/image1.jpg')   # moringa
    orig_img2 = z.read('word/media/image2.jpeg')  # coffee beans

# Read new header/footer assets
with zipfile.ZipFile(SRC_NEW_HF, 'r') as z:
    new_header1_xml = z.read('word/header1.xml').decode('utf-8')
    new_header2_xml = z.read('word/header2.xml').decode('utf-8')
    new_header3_xml = z.read('word/header3.xml').decode('utf-8')
    new_footer1_xml = z.read('word/footer1.xml').decode('utf-8')
    new_hdr_img1    = z.read('word/media/image1.png')   # header graphic
    new_hdr_img2    = z.read('word/media/image2.jpeg')  # footer graphic
    new_hdr_img3    = z.read('word/media/image3.png')   # extra

# Rename header/footer media references inside XML to use new non-colliding filenames
# header1.xml refs image1.png -> hdr1.png
# footer1.xml refs image2.jpeg -> hdr2.jpeg
new_header1_xml = new_header1_xml.replace('media/image1.png', 'media/hdr1.png')
new_header2_xml = new_header2_xml.replace('media/image1.png', 'media/hdr1.png')
new_header3_xml = new_header3_xml.replace('media/image1.png', 'media/hdr1.png')
new_footer1_xml = new_footer1_xml.replace('media/image2.jpeg', 'media/hdr2.jpeg')

# Build header rels pointing to renamed media
new_header1_rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/hdr1.png"/></Relationships>'
new_header2_rels = new_header1_rels
new_header3_rels = new_header1_rels
new_footer1_rels  = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/hdr2.jpeg"/></Relationships>'

# Read current template
with zipfile.ZipFile(SRC_TEMPLATE, 'r') as z:
    template_files = {}
    for name in z.namelist():
        template_files[name] = z.read(name)

doc_xml  = template_files['word/document.xml'].decode('utf-8')
doc_rels = template_files['word/_rels/document.xml.rels'].decode('utf-8')
ct       = template_files['[Content_Types].xml'].decode('utf-8')

# ── Fix sectPr: remove ALL existing headerReference/footerReference then add ours cleanly ──
doc_xml = re.sub(r'<w:headerReference[^/]*/>', '', doc_xml)
doc_xml = re.sub(r'<w:footerReference[^/]*/>', '', doc_xml)
doc_xml = re.sub(r'<w:titlePg/>', '', doc_xml)

# Rebuild sectPr close with our refs
our_sect_refs = (
    '<w:headerReference w:type="default" r:id="rIdHdr1"/>'
    '<w:footerReference w:type="default" r:id="rIdFtr1"/>'
    '<w:headerReference w:type="first" r:id="rIdHdr1"/>'
    '<w:footerReference w:type="first" r:id="rIdFtr1"/>'
    '<w:titlePg/>'
)
doc_xml = doc_xml.replace('</w:sectPr>', our_sect_refs + '</w:sectPr>', 1)

# ── Fix doc rels: ensure rIdHdr1/rIdFtr1 point to correct headers/footers ──
# Remove duplicates first
doc_rels = re.sub(r'<Relationship Id="rIdHdr[^"]*"[^/]*/>', '', doc_rels)
doc_rels = re.sub(r'<Relationship Id="rIdFtr[^"]*"[^/]*/>', '', doc_rels)
new_doc_rels = (
    '<Relationship Id="rIdHdr1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" '
    'Target="header1.xml"/>'
    '<Relationship Id="rIdFtr1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" '
    'Target="footer1.xml"/>'
)
doc_rels = doc_rels.replace('</Relationships>', new_doc_rels + '</Relationships>')

# ── Content-Types: add hdr1.png / hdr2.jpeg image types ──
if 'image/png' not in ct:
    ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
if 'image/jpeg' not in ct:
    ct = ct.replace('</Types>', '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>')

for override, ctype in [
    ('word/header1.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'),
    ('word/header2.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'),
    ('word/header3.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'),
    ('word/footer1.xml',  'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'),
]:
    tag = f'PartName="/{override}"'
    if tag not in ct:
        ct = ct.replace('</Types>', f'<Override PartName="/{override}" ContentType="{ctype}"/></Types>')

# ── Assemble final zip ──────────────────────────────────────────────────────────
with zipfile.ZipFile(TEMP, 'w', zipfile.ZIP_DEFLATED) as zout:
    # Write all existing template files, skipping ones we'll replace
    skip = {
        'word/document.xml', 'word/_rels/document.xml.rels', '[Content_Types].xml',
        'word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/footer1.xml',
        'word/_rels/header1.xml.rels', 'word/_rels/header2.xml.rels',
        'word/_rels/header3.xml.rels', 'word/_rels/footer1.xml.rels',
        'word/media/image1.jpg', 'word/media/image2.jpeg',  # restore originals
        'word/media/image1.png', 'word/media/image2.jpeg',  # remove collision
    }
    for name, data in template_files.items():
        if name not in skip:
            zout.writestr(name, data)

    # Patched core files
    zout.writestr('word/document.xml',            doc_xml.encode('utf-8'))
    zout.writestr('word/_rels/document.xml.rels', doc_rels.encode('utf-8'))
    zout.writestr('[Content_Types].xml',           ct.encode('utf-8'))

    # New header/footer XML (with renamed media references)
    zout.writestr('word/header1.xml',              new_header1_xml.encode('utf-8'))
    zout.writestr('word/header2.xml',              new_header2_xml.encode('utf-8'))
    zout.writestr('word/header3.xml',              new_header3_xml.encode('utf-8'))
    zout.writestr('word/footer1.xml',              new_footer1_xml.encode('utf-8'))
    zout.writestr('word/_rels/header1.xml.rels',   new_header1_rels.encode('utf-8'))
    zout.writestr('word/_rels/header2.xml.rels',   new_header2_rels.encode('utf-8'))
    zout.writestr('word/_rels/header3.xml.rels',   new_header3_rels.encode('utf-8'))
    zout.writestr('word/_rels/footer1.xml.rels',   new_footer1_rels.encode('utf-8'))

    # New non-colliding header/footer images
    zout.writestr('word/media/hdr1.png',   new_hdr_img1)
    zout.writestr('word/media/hdr2.jpeg',  new_hdr_img2)
    zout.writestr('word/media/hdr3.png',   new_hdr_img3)

    # Restored original body images
    zout.writestr('word/media/image1.jpg',  orig_img1)
    zout.writestr('word/media/image2.jpeg', orig_img2)

import shutil
shutil.move(TEMP, SRC_TEMPLATE)
print('Done — template rebuilt cleanly at:', SRC_TEMPLATE)
