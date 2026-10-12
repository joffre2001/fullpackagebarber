const SHEET_ID = '1s7M4Ps75RqNpEIkDBLcJflQiUOzcuT_IaY-jHzpzuGQ';
const BOOKING_HEADERS = ['id', 'createdAt', 'updatedAt', 'status', 'name', 'phone', 'service', 'date', 'time', 'notes', 'amountPaid', 'completedAt', 'archivedAt', 'source'];
const STATUSES = ['pending', 'approved', 'completed', 'cancelled', 'no_show'];
function setupSheet() { return getBookingSheet(); }
function setUpSheet() { return getBookingSheet(); }
function getBookingSheet() {
  const book = SpreadsheetApp.openById(SHEET_ID);
  const sheet = book.getSheetByName('Bookings') || book.insertSheet('Bookings');
  if (!sheet.getLastRow()) sheet.appendRow(BOOKING_HEADERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  // Append missing columns without reordering or overwriting existing data.
  BOOKING_HEADERS.forEach(name => {
    if (!headers.includes(name)) {
      headers.push(name);
      sheet.getRange(1, headers.length).setValue(name);
    }
  });
  return sheet;
}
function normalizeStatus(value) {
  return STATUSES.includes(String(value)) ? String(value) : 'pending';
}
function getBookings() {
  const sheet = getBookingSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.filter(row => row.some(value => value !== '')).map(row => {
    const booking = Object.fromEntries(headers.map((key, i) => [key, row[i] == null ? '' : row[i]]));
    booking.status = normalizeStatus(booking.status);
    if (booking.date instanceof Date) booking.date = Utilities.formatDate(booking.date, 'America/Sao_Paulo', 'yyyy-MM-dd');
    if (booking.time instanceof Date) booking.time = Utilities.formatDate(booking.time, 'America/Sao_Paulo', 'HH:mm');
    return booking;
  });
}
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return jsonResponse({ok:false, error:'Método não permitido'}); }
function doPost(e) {
  let lock;
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const adminActions = ['list', 'updateStatus', 'archiveHistory', 'clearHistory', 'createWalkIn'];
    if (adminActions.includes(payload.action)) {
      const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
      if (!expected || payload.adminKey !== expected) return jsonResponse({ok:false, error:'Acesso negado'});
    }
    if (payload.action === 'clearHistory') {
      return jsonResponse({ok:false, error:'Atualize o painel e use Arquivar histórico. Exclusão permanente desativada para preservar os relatórios.'});
    }
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    if (payload.action === 'list') {
      return jsonResponse({ok:true, apiVersion:3, bookings:getBookings()});
    }
    if (payload.action === 'createWalkIn') {
      const services = ['Corte Clássico', 'Aparar Barba', 'Fade & Taper', 'Signature', 'Executivo', 'Outro'];
      const date = String(payload.date || '');
      const parsed = new Date(date + 'T12:00:00Z');
      const today = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
      if (!services.includes(payload.service) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || date > today ||
          typeof payload.amountPaid !== 'number' || !Number.isFinite(payload.amountPaid) || payload.amountPaid < 0 || payload.amountPaid > 100000 ||
          typeof payload.id !== 'string' || !/^[a-zA-Z0-9-]{10,100}$/.test(payload.id)) {
        return jsonResponse({ok:false,error:'Confira serviço, data (até hoje) e valor recebido entre R$ 0 e R$ 100.000.'});
      }
      const sheet = getBookingSheet();
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(String);
      const previous = rows.slice(1).find(row => String(row[headers.indexOf('id')]) === payload.id);
      if (previous) return jsonResponse({ok:previous[headers.indexOf('source')] === 'walk_in', error:'Identificador já utilizado'});
      const now = new Date().toISOString();
      const clean = value => {
        const text = String(value || '').trim().slice(0,2000);
        return /^[=+@-]/.test(text) ? "'" + text : text;
      };
      const booking = {
        id:payload.id,source:'walk_in',status:'completed',createdAt:now,updatedAt:now,completedAt:now,
        name:clean(payload.name) || 'Cliente avulso',phone:clean(payload.phone),
        service:payload.service,date,time:'',notes:clean(payload.notes),
        amountPaid:Math.round(payload.amountPaid*100)/100,archivedAt:''
      };
      sheet.appendRow(headers.map(key => booking[key] == null ? '' : booking[key]));
      return jsonResponse({ok:true,id:booking.id});
    }

    if (payload.action === 'updateStatus') {
      if (!payload.id || !STATUSES.includes(payload.status)) return jsonResponse({ok:false,error:'Reserva ou status inválido'});
      const sheet = getBookingSheet();
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(String);
      const index = rows.findIndex((row, i) => i > 0 && String(row[headers.indexOf('id')]) === String(payload.id));
      if (index < 1) return jsonResponse({ok:false,error:'Reserva não encontrada'});
      const row = rows[index];
      if(row[headers.indexOf('source')] === 'walk_in' && !['completed','cancelled'].includes(payload.status)) return jsonResponse({ok:false,error:'Atendimento avulso deve ser concluído ou anulado.'});
      if (row[headers.indexOf('archivedAt')]) return jsonResponse({ok:false,error:'Restaure o histórico antes de editar esta reserva.'});
      let amount = '';
      if (payload.status === 'completed') {
        if (typeof payload.amountPaid !== 'number' || !Number.isFinite(payload.amountPaid) || payload.amountPaid < 0 || payload.amountPaid > 100000) {
          return jsonResponse({ok:false,error:'Informe um valor recebido válido entre R$ 0 e R$ 100.000.'});
        }
        amount = Math.round(payload.amountPaid * 100) / 100;
      }
      const now = new Date().toISOString();
      row[headers.indexOf('status')] = payload.status;
      row[headers.indexOf('updatedAt')] = now;
      row[headers.indexOf('amountPaid')] = amount;
      row[headers.indexOf('completedAt')] = payload.status === 'completed' ? (row[headers.indexOf('completedAt')] || now) : '';
      sheet.getRange(index + 1, 1, 1, headers.length).setValues([row]);
      return jsonResponse({ok:true});
    }
    if (payload.action === 'archiveHistory') {
      const sheet = getBookingSheet();
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(String);
      let count = 0;
      const now = new Date().toISOString();
      for (let i = 1; i < rows.length; i++) {
        if (['completed','cancelled','no_show'].includes(rows[i][headers.indexOf('status')]) && !rows[i][headers.indexOf('archivedAt')]) {
          rows[i][headers.indexOf('archivedAt')] = now;
          count++;
        }
      }
      if (count) sheet.getRange(2, 1, rows.length - 1, headers.length).setValues(rows.slice(1));
      return jsonResponse({ok:true, count});
    }
    if (payload.action === 'save' || (!payload.action && payload.name && payload.phone)) {
      if (!['name','phone','service','date','time'].every(key => typeof payload[key] === 'string' && payload[key].trim())) {
        return jsonResponse({ok:false,error:'Preencha os campos obrigatórios'});
      }
      const sheet = getBookingSheet();
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(String);
      const id = String(payload.id || Utilities.getUuid());
      if (rows.slice(1).some(row => String(row[headers.indexOf('id')]) === id)) return jsonResponse({ok:true});
      const now = new Date().toISOString();
      // Public submissions cannot set revenue, completed status, or archival fields.
      const booking = {id,createdAt:now,updatedAt:now,status:'pending',source:'reservation'};
      ['name','phone','service','date','time','notes'].forEach(key => {
        const value = String(payload[key] || '').slice(0,2000);
        booking[key] = /^[=+@-]/.test(value) ? "'" + value : value;
      });
      sheet.appendRow(headers.map(key => booking[key] == null ? '' : booking[key]));
      return jsonResponse({ok:true});
    }
    return jsonResponse({ok:false,error:'Ação inválida'});
  } catch (error) {
    return jsonResponse({ok:false,error:'Não foi possível processar a solicitação. Verifique a implantação e as permissões da planilha.'});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
