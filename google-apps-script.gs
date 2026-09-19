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

function getBookings() {
  const spreadSheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadSheet.getSheetByName('Bookings');

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const headers = values[0];
  const rows = values.slice(1).map((row) => {
    return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
  });

  return rows;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({ ok: false, error: 'Método não permitido' });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    if (payload.action === 'list') {
      const expectedKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');

      if (!expectedKey || payload.adminKey !== expectedKey) {
        return jsonResponse({ ok: false, error: 'Acesso negado' });
      }

      return jsonResponse({ ok: true, bookings: getBookings() });
    }

    if (!payload || !payload.name || !payload.phone || !payload.service || !payload.date || !payload.time) {
      return jsonResponse({ ok: false, error: 'Dados inválidos' });
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

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: 'Não foi possível processar a solicitação' });
  }
}
