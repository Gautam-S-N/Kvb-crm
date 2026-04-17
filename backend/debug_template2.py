"""
Two issues to fix:
1. rId9 -> image1.jpg (moringa leaves - fine to keep)
   rId10 -> image2.jpeg (coffee beans image in original dryer doc BUT
            our patch script overwrote image2.jpeg with the footer image from New_Header!)
   This means the body's "coffee beans" placeholder is now showing the footer logo instead.

Fix: Rename body images to avoid collision with header/footer images.
   - Keep header images as image1.png, image2.jpeg, image3.png (referenced by header1/footer1 rels)
   - Rename body images: rId9 -> body_img1.jpg, rId10 -> body_img2.jpg

Also:  
   The header references: rIdHdr1, rIdFtr1 are in sectPr but the original document 
   already had rId14->header1, rId15->header2, rId16->footer1, rId17->header3 from python-docx save.
   The sectPr from the original didn't have w:headerReference tags because python-docx 
   saved it without them, and our patch added rIdHdr1/rIdFtr1 tags.
   BUT the original also saved its OWN header files (from the original dryer docx) which might be empty.

Strategy:
   A) Rename body image files to body_img1.jpg / body_img2.jpg to avoid collision
   B) Update document.xml to use new rIds for body images
   C) Update document.xml.rels accordingly
   D) Make sure sectPr only references our new header/footer via rIdHdr1/rIdFtr1
   E) Remove the OLD conflicting header references (rId14, rId15, rId16, rId17) from sectPr
"""

import zipfile
import shutil
import re
import io

SRC = 'D:/kvb-crm/backend/src/assets/dryer_template.docx'
DST = SRC + '.fixed'

with zipfile.ZipFile(SRC, 'r') as z:
    all_files = z.namelist()
    files = {}
    for name in all_files:
        files[name] = z.read(name)

doc_xml = files['word/document.xml'].decode('utf-8')
doc_rels = files['word/_rels/document.xml.rels'].decode('utf-8')

# ── Step 1: Rename body images to avoid collision ──────────────────────────────
# The body uses rId9 (image1.jpg) and rId10 (image2.jpeg)
# But image2.jpeg has been overwritten by our footer image!
# We need to:
# a) Restore the original dryer body images
# Actually we cannot restore them since they were overwritten.
# But wait - in Dryer format for CRM.docx, what were the two body images?

# Let's read from the ORIGINAL dryer doc and get them back
with zipfile.ZipFile('D:/kvb-crm/Dryer format for CRM.docx', 'r') as orig:
    orig_names = orig.namelist()
    orig_media = {n: orig.read(n) for n in orig_names if 'media' in n}
    print('Original dryer doc media:', list(orig_media.keys()))
    orig_doc_rels = orig.read('word/_rels/document.xml.rels').decode('utf-8')
    print('Original rels:', orig_doc_rels[:500])
