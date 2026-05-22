MATERIAL REQUEST UPDATE — HOW TO APPLY ON A SERVER
====================================================

This update adds Type and Size columns to the DC Raw Materials and
Dryer Components pages in the Material Requests section.


WHAT YOU ARE RECEIVING
-----------------------

You will receive 7 files total:

  3 Frontend files:
    - DCCatalogTab.jsx
    - DCRawMaterials.jsx
    - DryerComponents.jsx

  3 Backend files:
    - material.controller.js
    - reseedDCRaw.js
    - reseedDryer.js

  1 Excel file:
    - DC LIST 2026.xlsx


===========================================================
OPTION A — IF YOU ACCESS THE SERVER VIA SSH (Linux Server)
===========================================================

STEP 1 — Upload the files to the server

  Use FileZilla or SCP to copy the files.

  If using SCP, run these from your local machine:

    scp DCCatalogTab.jsx    user@server-ip:/path/to/kvb-crm/frontend/src/components/materialRequest/DCCatalogTab.jsx
    scp DCRawMaterials.jsx  user@server-ip:/path/to/kvb-crm/frontend/src/pages/DCRawMaterials.jsx
    scp DryerComponents.jsx user@server-ip:/path/to/kvb-crm/frontend/src/pages/DryerComponents.jsx

    scp material.controller.js user@server-ip:/path/to/kvb-crm/backend/src/controllers/material.controller.js
    scp reseedDCRaw.js         user@server-ip:/path/to/kvb-crm/backend/scripts/reseedDCRaw.js
    scp reseedDryer.js         user@server-ip:/path/to/kvb-crm/backend/scripts/reseedDryer.js

    scp "DC LIST 2026.xlsx"    user@server-ip:/path/to/kvb-crm/DC LIST 2026.xlsx

  Replace "user@server-ip" and "/path/to/kvb-crm" with your actual
  server username, IP address, and project folder path.


STEP 2 — Update the Excel file path in the scripts

  The reseed scripts have a hardcoded path. SSH into the server and
  open each script to update it:

    nano /path/to/kvb-crm/backend/scripts/reseedDCRaw.js
    nano /path/to/kvb-crm/backend/scripts/reseedDryer.js

  Find this line in both files:
    const wb = XLSX.readFile('D:/kvb-crm/DC LIST 2026.xlsx');

  Change it to the actual path on the Linux server, for example:
    const wb = XLSX.readFile('/home/user/kvb-crm/DC LIST 2026.xlsx');


STEP 3 — Run the reseed scripts on the server

  SSH into the server and run:

    cd /path/to/kvb-crm/backend
    node scripts/reseedDryer.js
    node scripts/reseedDCRaw.js


STEP 4 — Restart the backend

  If using PM2:
    pm2 restart kvb-crm-backend

  If running manually:
    Stop and restart:  npm start

  If using systemd service:
    sudo systemctl restart kvb-crm


STEP 5 — Rebuild the frontend (if it was built as a static site)

  If the frontend was built using "npm run build":

    cd /path/to/kvb-crm/frontend
    npm run build

  Then redeploy the "dist" folder to your web server (Nginx/Apache).

  If the frontend is running as a dev server, just hard refresh the browser.


===========================================================
OPTION B — IF YOU ACCESS THE SERVER VIA REMOTE DESKTOP (RDP)
===========================================================

STEP 1 — Connect via Remote Desktop
  Open Remote Desktop Connection (mstsc) and connect to the server IP.

STEP 2 — Copy the files
  Copy the 6 code files and the Excel file from your local machine
  and paste them into the correct folders on the server:

    frontend/src/components/materialRequest/DCCatalogTab.jsx
    frontend/src/pages/DCRawMaterials.jsx
    frontend/src/pages/DryerComponents.jsx
    backend/src/controllers/material.controller.js
    backend/scripts/reseedDCRaw.js
    backend/scripts/reseedDryer.js
    DC LIST 2026.xlsx  →  place in the root kvb-crm folder

STEP 3 — Update the Excel path if needed
  If the project is NOT in D:/kvb-crm/ on the server, open
  reseedDCRaw.js and reseedDryer.js in Notepad and update:

    const wb = XLSX.readFile('D:/kvb-crm/DC LIST 2026.xlsx');

  Change the path to wherever the project is on the server.

STEP 4 — Run the scripts
  Open Command Prompt or PowerShell on the server, navigate to
  the backend folder and run:

    node scripts/reseedDryer.js
    node scripts/reseedDCRaw.js

STEP 5 — Restart the backend
  If using PM2:
    pm2 restart kvb-crm-backend

  If running in a terminal window:
    Close the old terminal and restart:  npm start

STEP 6 — Rebuild frontend if needed
  If the frontend was built (not dev server):
    cd frontend
    npm run build
  Then serve the "dist" folder again.


===========================================================
OPTION C — IF THEY USE A CONTROL PANEL (cPanel / Plesk)
===========================================================

STEP 1 — Upload files via File Manager
  Log into cPanel or Plesk, open the File Manager and navigate
  to the kvb-crm project folder.
  Upload and replace the 6 code files in the correct locations.
  Upload the Excel file into the root kvb-crm folder.

STEP 2 — Update the Excel path in the scripts
  Open reseedDCRaw.js and reseedDryer.js in the File Manager editor.
  Find this line:
    const wb = XLSX.readFile('D:/kvb-crm/DC LIST 2026.xlsx');
  Update it to the correct server path (shown in the File Manager address bar).

STEP 3 — Run scripts via Terminal
  In cPanel, go to:  Advanced → Terminal
  In Plesk, go to:  Tools & Utilities → SSH Terminal
  Then run:

    cd /home/username/kvb-crm/backend
    node scripts/reseedDryer.js
    node scripts/reseedDCRaw.js

STEP 4 — Restart the Node.js application
  In cPanel:  Go to Software → Setup Node.js App → Restart
  In Plesk:   Go to the Node.js app section → Restart

STEP 5 — Rebuild frontend if needed
  In the terminal:
    cd /home/username/kvb-crm/frontend
    npm run build
  Then point the domain to the "dist" folder.


===========================================================
NO MATTER WHICH METHOD — WHAT STAYS THE SAME
===========================================================

  - No changes to database structure
  - No new npm packages to install
  - No changes to .env files
  - Just replace the 6 files, run the 2 scripts, restart the backend


WHAT CHANGED
-------------

  DC Raw Materials tab  — Now shows Type and Size columns
  Dryer Components tab  — Now shows Size column
  Material ordering     — Materials now appear in the same order
                          as the Excel file (not alphabetical)


====================================================
KVB CRM — May 2026
