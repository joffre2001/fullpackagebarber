const SHEET_ID = '1s7M4Ps75RqNpEIkDBLcJflQiUOzcuT_IaY-jHzpzuGQ';

function setupSheet() {
  return getBookingSheet();
}

function setUpSheet() {
  return getBookingSheet();
}

function getBookingSheet() {
  const spreadSheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadSheet.getSheetByName('Bookings');

  if (!sheet) {
    sheet = spreadSheet.insertSheet('Bookings');
  }

  const headers = ['createdAt', 'name', 'phone', 'service', 'date', 'time', 'notes'];
  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];

  if (JSON.stringify(currentHeaders) !== JSON.stringify(headers)) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function doGet() {
  const spreadSheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadSheet.getSheetByName('Bookings');

  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headers = values[0];
  const rows = values.slice(1).map((row) => {
    return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
  });

  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    if (!payload || !payload.name || !payload.phone || !payload.service || !payload.date || !payload.time) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Dados inválidos' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getBookingSheet();
    const row = [
      new Date().toISOString(),
      payload.name,
      payload.phone,
      payload.service,
      payload.date,
      payload.time,
      payload.notes || ''
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
