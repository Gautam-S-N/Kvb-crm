"""
Transplants header/footer from New_Header&Footer1.docx into dryer_template.docx
and updates document.xml to reference the new headers/footers.
Saves final output as dryer_template.docx (overwrite in place).
"""
import zipfile
import io
import re
import shutil
import os

SRC_HEADER     = 'D:/kvb-crm/New_Header&Footer1.docx'
SRC_TEMPLATE   = 'D:/kvb-crm/backend/src/assets/dryer_template.docx'
OUTPUT_PATH    = 'D:/kvb-crm/backend/src/assets/dryer_template.docx'
TEMP_PATH      = SRC_TEMPLATE + '.tmp'

def read_zip(path, name):
    with zipfile.ZipFile(path, 'r') as z:
        return z.read(name)

def write_zip(in_path, out_path, modifications):
    """Read zip, apply modifications dict {name: bytes}, write new zip."""
    with zipfile.ZipFile(in_path, 'r') as zin, \
         zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        # Write existing files (skip ones being replaced)
        for item in zin.infolist():
            if item.filename in modifications:
                continue
            zout.writestr(item, zin.read(item.filename))
        # Write new/modified files
        for name, data in modifications.items():
            zout.writestr(name, data)

# ── Read assets from New_Header&Footer1.docx ──────────────────────────────────
with zipfile.ZipFile(SRC_HEADER, 'r') as zh:
    header1_xml   = zh.read('word/header1.xml')
    header2_xml   = zh.read('word/header2.xml')
    header3_xml   = zh.read('word/header3.xml')
    footer1_xml   = zh.read('word/footer1.xml')
    header1_rels  = zh.read('word/_rels/header1.xml.rels')
    header2_rels  = zh.read('word/_rels/header2.xml.rels')
    header3_rels  = zh.read('word/_rels/header3.xml.rels')
    footer1_rels  = zh.read('word/_rels/footer1.xml.rels')
    hdr_image1    = zh.read('word/media/image1.png')   # header image
    hdr_image2    = zh.read('word/media/image2.jpeg')  # footer image
    hdr_image3    = zh.read('word/media/image3.png')   # any extra

# ── Read existing template's document.xml to patch sectPr ─────────────────────
with zipfile.ZipFile(SRC_TEMPLATE, 'r') as zt:
    doc_xml = zt.read('word/document.xml').decode('utf-8')
    doc_rels = zt.read('word/_rels/document.xml.rels').decode('utf-8')
    content_types = zt.read('[Content_Types].xml').decode('utf-8')

# ── Inject header/footer references into sectPr in document.xml ───────────────
# Remove any existing headerReference / footerReference tags
doc_xml = re.sub(r'<w:headerReference[^/]*/>', '', doc_xml)
doc_xml = re.sub(r'<w:footerReference[^/]*/>', '', doc_xml)

header_refs = (
    '<w:headerReference w:type="default" r:id="rIdHdr1"/>'
    '<w:footerReference w:type="default" r:id="rIdFtr1"/>'
    '<w:headerReference w:type="first" r:id="rIdHdr1"/>'
    '<w:footerReference w:type="first" r:id="rIdFtr1"/>'
)

# Inject before </w:sectPr>
doc_xml = doc_xml.replace('</w:sectPr>', header_refs + '</w:sectPr>', 1)

# Also enable different first page if needed — ensure titlePg is present
if '<w:titlePg/>' not in doc_xml:
    doc_xml = doc_xml.replace('</w:sectPr>', '<w:titlePg/></w:sectPr>', 1)

# ── Add header/footer relationship IDs into document.xml.rels ─────────────────
new_rels = (
    '<Relationship Id="rIdHdr1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" '
    'Target="header1.xml"/>'
    '<Relationship Id="rIdHdr2" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" '
    'Target="header2.xml"/>'
    '<Relationship Id="rIdFtr1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" '
    'Target="footer1.xml"/>'
)
doc_rels = doc_rels.replace('</Relationships>', new_rels + '</Relationships>')

# ── Add Content-Type entries for headers/footers if missing ───────────────────
ct_additions = []
if 'word/header1.xml' not in content_types:
    ct_additions.append('<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>')
if 'word/header2.xml' not in content_types:
    ct_additions.append('<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>')
if 'word/footer1.xml' not in content_types:
    ct_additions.append('<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>')

if ct_additions:
    content_types = content_types.replace('</Types>', ''.join(ct_additions) + '</Types>')

# ── Remap header image references from rId1 -> use original IDs ───────────────
# The header1.xml.rels uses rId1 -> image1.png
# We rename these media files to avoid collisions with template's own media
header1_xml_str = header1_xml.decode('utf-8').replace('word/media/', 'word/media/')
footer1_xml_str = footer1_xml.decode('utf-8')

# ── Bundle all modifications ───────────────────────────────────────────────────
modifications = {
    'word/document.xml':            doc_xml.encode('utf-8'),
    'word/_rels/document.xml.rels': doc_rels.encode('utf-8'),
    '[Content_Types].xml':          content_types.encode('utf-8'),
    'word/header1.xml':             header1_xml,
    'word/header2.xml':             header2_xml,
    'word/header3.xml':             header3_xml,
    'word/footer1.xml':             footer1_xml,
    'word/_rels/header1.xml.rels':  header1_rels,
    'word/_rels/header2.xml.rels':  header2_rels,
    'word/_rels/header3.xml.rels':  header3_rels,
    'word/_rels/footer1.xml.rels':  footer1_rels,
    'word/media/image1.png':        hdr_image1,
    'word/media/image2.jpeg':       hdr_image2,
    'word/media/image3.png':        hdr_image3,
}

write_zip(SRC_TEMPLATE, TEMP_PATH, modifications)
shutil.move(TEMP_PATH, OUTPUT_PATH)
print('Done. Template saved to:', OUTPUT_PATH)
