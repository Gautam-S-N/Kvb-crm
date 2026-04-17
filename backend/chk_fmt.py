import openpyxl
wb = openpyxl.load_workbook('D:/kvb-crm/backend/src/assets/po_template.xlsx', data_only=True)
ws = wb.active
# Check number formats on total cells
for ref in ['N32','N33','N34','N35','M33']:
    cell = ws[ref]
    print(f"{ref}: value={repr(cell.value)}, numFmt={repr(cell.number_format)}, data_type={repr(cell.data_type)}")
