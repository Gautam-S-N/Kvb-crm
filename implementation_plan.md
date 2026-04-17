# Implement Quotation DOCX Download & Asset Updates

The objective is to allow users to generate exactly the same dynamic Quotations and download them in a fully editable Microsoft Word (`.docx`) format, alongside the existing PDF generator. Additionally, we need to instruct the system/user on how to replace the background graphic.

## User Action Required

> [!IMPORTANT]
> **Background Image Swap**
> Because I am an AI, I cannot directly download the image you attached in this chat interface to the server's hard drive automatically. To apply your new background, please save the image you just uploaded directly over this file on your local machine:
> `d:\kvb-crm\backend\src\assets\dryer\image4.jpeg`
> Once you overwrite that file, the PDF will instantly and automatically use your new background!

> [!WARNING]
> Please review the proposed DOCX functionality below and click "Approve" if the implementation aligns with your expectations.

## Proposed Changes

---

### Backend Components

#### [MODIFY] `quotation.routes.js`
- Expose a new REST endpoint: `GET /download-docx/:id` directly beside the existing `/download/:id` (PDF) endpoint.

#### [MODIFY] `quotation.controller.js`
- Integrate the newly installed `html-to-docx` library.
- Implement the `downloadDOCX` controller method. This function will fetch the quotation data, reuse our exact `buildSolarTunnelDryerHTML` template schema, convert it cleanly to DOCX format using `htmlToDocx()`, and set the `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` for proper File-Save behavior on the browser.
- Adjust image references (base64 embeddings) if `html-to-docx` struggles with absolute paths, ensuring graphics render correctly in Word.

---

### Frontend Components

#### [MODIFY] `quotationStore.js`
- Copy the existing `downloadPDF` API method and create a new `downloadDOCX` method that streams the blob from `/download-docx/:id` and triggers the browser save flow.

#### [MODIFY] `Quotations.jsx`
- Find the existing "Download PDF" UI element on the quotation cards.
- Add an adjacent, identically styled button: `[Download DOCX]`.
- Bind it to the `downloadDOCX` function in the store.

#### [MODIFY] `LeadDetail.jsx`
- In the "Quotations" tab inside a Lead's extended view, add a tiny DOCX icon/button next to the PDF icon inside the Quotation table rows.

## Open Questions

- `html-to-docx` automatically translates standard HTML layout into Word, but strictly positioned full-page CSS backgrounds (like our `position: fixed` watermark) are often ignored or poorly handled by Word's proprietary rendering engine, reducing it to standard flow text. While the text will be 100% editable as requested, the Word document might not perfectly maintain the full-page visual watermarks like the PDF does. Are you okay with the DOCX version being a "raw editable" version, while the PDF remains the "perfect visual" version?

## Verification Plan

### Automated / API Verification
- Attempt to generate the DOCX buffer directly on the backend using dummy data to ensure no `html-to-docx` engine compilation crashes.
- Inspect the file buffer structure to guarantee it is valid OpenXML.

### Application Verification
- Reload the Frontend and verify the appearance of the new `[DOCX]` buttons.
- Click the button and confirm that a `.docx` file downloads successfully and opens cleanly in standard text editors.
