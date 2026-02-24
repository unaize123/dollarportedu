# Google Sheets Lead Sync Setup

This project can sync each lead submission to Google Sheets using a webhook URL.

## 1) Create the Sheet

1. Create a Google Sheet.
2. Add a tab named `Leads`.
3. Add headers in row 1:
   - `leadId`
   - `leadType`
   - `name`
   - `email`
   - `phone`
   - `courseInterest`
   - `experienceLevel`
   - `budgetRange`
   - `message`
   - `sourcePage`
   - `utmSource`
   - `utmMedium`
   - `utmCampaign`
   - `createdAt`

## 2) Create Apps Script Webhook

1. Open the sheet -> Extensions -> Apps Script.
2. Replace script content with:

```javascript
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Leads sheet not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow([
      payload.leadId || '',
      payload.leadType || '',
      payload.name || '',
      payload.email || '',
      payload.phone || '',
      payload.courseInterest || '',
      payload.experienceLevel || '',
      payload.budgetRange || '',
      payload.message || '',
      payload.sourcePage || '',
      payload.utmSource || '',
      payload.utmMedium || '',
      payload.utmCampaign || '',
      payload.createdAt || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Deploy -> New deployment -> type `Web app`.
4. Execute as: `Me`.
5. Who has access: `Anyone`.
6. Deploy and copy the Web App URL.

## 3) Add Environment Variable

In `.env`:

```env
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXXXXXXXXXXX/exec
```

## 4) Restart Server

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
node app.js
```

## 5) Verify

Submit any lead form from the website and check the `Leads` tab.
