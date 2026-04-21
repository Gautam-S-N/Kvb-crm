"""
Applies docxtemplater tags to the Solar Parabolic Cooker docx.
Table 1 → pricing tags
Table 2 → loop tags for dynamic feasibility rows (keep header, replace data rows with 1 loop row)
Para 9 → payback period tag
"""
import docx, copy
from lxml import etree

def set_cell_text(cell, text):
    """Clear cell and set new text, preserving paragraph formatting of first para."""
    para = cell.paragraphs[0]
    for run in para.runs:
        run.text = ''
        run.font.highlight_color = None
    if para.runs:
        para.runs[0].text = text
    else:
        run = para.add_run(text)

def unhighlight_all_runs(cell):
    for para in cell.paragraphs:
        for run in para.runs:
            run.font.highlight_color = None

def apply_tags(src, dst):
    doc = docx.Document(src)

    # ── Para 9: payback period ──────────────────────────────────────
    # Text: "...less than 1 year (10 Months)."
    # Highlighted runs contain "1 year (10 Months)."
    for para in doc.paragraphs:
        has_highlight = any(r.font.highlight_color for r in para.runs)
        if has_highlight:
            # Collect highlighted runs into one tag, remove rest
            highlighted_indices = [i for i, r in enumerate(para.runs) if r.font.highlight_color]
            if highlighted_indices:
                # Set first highlighted run to tag
                first_idx = highlighted_indices[0]
                para.runs[first_idx].text = '{paybackPeriod}'
                para.runs[first_idx].font.highlight_color = None
                # Clear all other highlighted runs
                for i in highlighted_indices[1:]:
                    para.runs[i].text = ''
                    para.runs[i].font.highlight_color = None

    # ── Table 1: pricing ────────────────────────────────────────────
    t1 = doc.tables[1]

    # R1: product row
    set_cell_text(t1.rows[1].cells[1], '{item_desc}')
    set_cell_text(t1.rows[1].cells[2], '{item_qty}')
    set_cell_text(t1.rows[1].cells[3], '{item_price}')
    unhighlight_all_runs(t1.rows[1].cells[0])

    # R2: GST row — replace "18%" with tag in C0,C1,C2 and amount in C3
    for ci in [0, 1, 2]:
        cell = t1.rows[2].cells[ci]
        set_cell_text(cell, 'GST {gstRate}%')
    set_cell_text(t1.rows[2].cells[3], '{gstAmount}')

    # R3: Packing row
    for ci in [0, 1, 2]:
        set_cell_text(t1.rows[3].cells[ci], 'Packing {packingRate}%')
    set_cell_text(t1.rows[3].cells[3], '{packingCharge}')

    # R4: Freight — just unhighlight, but make value editable
    for ci in [0, 1, 2]:
        unhighlight_all_runs(t1.rows[4].cells[ci])
    set_cell_text(t1.rows[4].cells[3], '{freightTerms}')

    # R5: Installation — unhighlight labels, tag value
    for ci in [0, 1, 2]:
        unhighlight_all_runs(t1.rows[5].cells[ci])
    set_cell_text(t1.rows[5].cells[3], '{installCharge}')

    # ── Table 2: dynamic feasibility rows ───────────────────────────
    t2 = doc.tables[2]

    # Keep R0 (header). Set R1 as the loop template row.
    data_row = t2.rows[1]
    set_cell_text(data_row.cells[0], '{#feasibilityRows}{noOfMonth}')
    set_cell_text(data_row.cells[1], '{lpgPerMonth}')
    set_cell_text(data_row.cells[2], '{kgOfLpg}')
    set_cell_text(data_row.cells[3], '{amount}')
    set_cell_text(data_row.cells[4], '{totalAmount}{/feasibilityRows}')
    for cell in data_row.cells:
        unhighlight_all_runs(cell)

    # Delete rows R2, R3, R4 (extra data rows — docxtemplater loop handles them)
    tbl_element = t2._tbl
    for row in list(t2.rows)[2:]:  # delete rows index 2 onwards
        tbl_element.remove(row._tr)

    doc.save(dst)
    print(f'Saved tagged template to: {dst}')

if __name__ == '__main__':
    apply_tags(
        'SOLAR PARABOLIC COOKER.docx',
        'backend/src/assets/cooker_template.docx'
    )
